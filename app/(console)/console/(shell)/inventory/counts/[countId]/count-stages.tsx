'use client';

import type { CountStatus } from '@bliss/shared/domain';
import { formatQty, plural } from '@bliss/shared/format';
import { type Cents, ZERO, add, formatKes } from '@bliss/shared/money';
import { applyQuickReason, checkReason } from '@bliss/shared/reason';
import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice, Progress } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { StatusChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowBackUp, IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { commitCount, recordCounted, recountLine, submitForReview } from '../../../_actions/inventory';

interface BlindLine {
  id: string;
  name: string;
  category: string;
  unit: string;
  countedQty: number | null;
}

/**
 * Counting. Designed for a tablet at 1024 wide: a list of lines with a large numeric input each.
 * There is no expected column because the page never received an expected figure.
 */
export function CountBlind({ countId, title, meta, lines }: { countId: string; title: string; meta: string; lines: BlindLine[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, l.countedQty === null ? '' : String(l.countedQty)])));
  const [saving, setSaving] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counted = lines.filter((l) => (values[l.id] ?? '').trim() !== '').length;

  const save = async (line: BlindLine) => {
    const raw = (values[line.id] ?? '').trim();
    const qty = raw === '' ? null : Number(raw);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0)) {
      setSaving((s) => ({ ...s, [line.id]: 'error' }));
      return;
    }
    setSaving((s) => ({ ...s, [line.id]: 'saving' }));
    const result = await recordCounted({ countLineId: line.id, countedQty: qty });
    setSaving((s) => ({ ...s, [line.id]: result.ok ? 'saved' : 'error' }));
  };

  return (
    <div className="max-w-[1024px] pb-96">
      <ButtonLink href="/console/inventory/counts" variant="ghost" icon={IconArrowLeft} className="-ml-16">
        All counts
      </ButtonLink>
      <div className="mt-12 flex flex-wrap items-center gap-12">
        <h2 className="text-title text-ink first-letter:uppercase">{title}</h2>
        <StatusChip status="counting" />
      </div>
      <p className="mt-4 text-body text-ink-subtle">{meta}</p>
      <p className="mt-16 text-body text-ink-muted">Count what is physically there. Part bottles in tenths: 0.4 is a bottle a little under half full.</p>

      <ul className="mt-24 border-t border-rule">
        {lines.map((line) => {
          const state = saving[line.id];
          return (
            <li key={line.id} className="grid grid-cols-[minmax(200px,1fr)_96px_200px_96px] items-center gap-16 border-b border-rule py-12">
              <span className="min-w-0">
                <span className="block truncate text-body-lg text-ink">{line.name}</span>
                <span className="block text-body-sm text-ink-subtle">{line.category}</span>
              </span>
              <span className="text-body text-ink-muted">{line.unit}</span>
              <input
                aria-label={`Counted ${line.unit} of ${line.name}`}
                inputMode="decimal"
                value={values[line.id] ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setValues((v) => ({ ...v, [line.id]: value }));
                }}
                onBlur={() => void save(line)}
                placeholder="··"
                className={cx(
                  'h-control-xl w-full border-b-2 bg-transparent text-right font-mono tabular text-num-lg text-ink outline-none placeholder:text-ink-disabled focus:border-accent',
                  state === 'error' ? 'border-stop' : 'border-hairline',
                )}
              />
              <span className={cx('text-body-sm', state === 'error' ? 'text-stop' : state === 'saved' ? 'text-poured' : 'text-ink-subtle')} aria-live="polite">
                {state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : state === 'error' ? 'Zero or more' : ''}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="fixed bottom-[56px] left-[252px] right-32 z-10 flex items-center gap-24 rounded-md border border-hairline bg-raised px-20 py-12 shadow-raised">
        <Progress value={counted} max={lines.length} label={`${counted} of ${lines.length} counted`} className="min-w-0 flex-1" />
        {error ? <p className="max-w-[320px] text-body-sm text-stop">{error}</p> : null}
        <Button
          variant="primary"
          size="lg"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await submitForReview({ countId });
              if (!result.ok) setError(result.message);
              else router.refresh();
            })
          }
        >
          Submit for review
        </Button>
      </div>
    </div>
  );
}

interface ReviewLine {
  id: string;
  name: string;
  category: string;
  unit: string;
  expectedQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  varianceCents: Cents | null;
  reason: string | null;
  tolerancePct: number;
  outside: boolean;
}

const QUICK = ['Breakage not recorded', 'Delivery short', 'Miscount, recounted', 'Unknown'];

/** Review: expected appears now. Lines outside tolerance need a reason before the count commits. */
export function CountReview({
  countId,
  title,
  meta,
  status,
  committedNote,
  lines,
}: {
  countId: string;
  title: string;
  meta: string;
  status: CountStatus;
  committedNote: string | null;
  lines: ReviewLine[];
}) {
  const router = useRouter();
  const editable = status === 'review';
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(lines.filter((l) => l.outside).map((l) => [l.id, l.reason ?? ''])));
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = useMemo(() => lines.reduce((sum, l) => add(sum, l.varianceCents ?? ZERO), ZERO), [lines]);
  const missing = lines.filter((l) => l.outside && !checkReason(reasons[l.id] ?? '').ok);
  const ordered = [...lines].sort((a, b) => Number(b.outside) - Number(a.outside) || Math.abs(b.varianceQty ?? 0) - Math.abs(a.varianceQty ?? 0));

  return (
    <div className="pb-40">
      <ButtonLink href="/console/inventory/counts" variant="ghost" icon={IconArrowLeft} className="-ml-16">
        All counts
      </ButtonLink>
      <div className="mt-12 flex flex-wrap items-center gap-12">
        <h2 className="text-title text-ink first-letter:uppercase">{title}</h2>
        <StatusChip status={status} />
      </div>
      <p className="mt-4 text-body text-ink-subtle">{meta}</p>
      {committedNote ? <InlineNotice tone="poured" className="mt-12">{committedNote}</InlineNotice> : null}
      {notice ? <InlineNotice tone="stop" className="mt-12">{notice}</InlineNotice> : null}

      <div role="table" aria-label="Count review" className="mt-24">
        <div role="row" className="grid grid-cols-[minmax(180px,1.4fr)_90px_90px_100px_120px_minmax(260px,2fr)_120px] items-center gap-16 border-b border-hairline px-4 pb-8">
          {['Product', 'Expected', 'Counted', 'Variance', 'Value', 'Reason', ''].map((h, i) => (
            <span key={h || i} role="columnheader" className={cx('text-label text-ink-subtle', i >= 1 && i <= 4 && 'text-right')}>
              {h}
            </span>
          ))}
        </div>
        {ordered.map((l) => {
          const tone = l.varianceQty === null || l.varianceQty === 0 ? 'text-ink-subtle' : !l.outside ? 'text-poured' : l.varianceQty < 0 ? 'text-stop' : 'text-low';
          return (
            <div key={l.id} role="row" className="grid grid-cols-[minmax(180px,1.4fr)_90px_90px_100px_120px_minmax(260px,2fr)_120px] items-start gap-16 border-b border-rule px-4 py-12">
              <span role="cell" className="min-w-0">
                <span className="block truncate text-body text-ink">{l.name}</span>
                <span className="block text-body-sm text-ink-subtle">
                  {l.category} · tolerance {l.tolerancePct}%
                </span>
              </span>
              <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                {formatQty(l.expectedQty, 2)}
              </span>
              <span role="cell" className="text-right font-mono tabular text-num text-ink">
                {l.countedQty === null ? '··' : formatQty(l.countedQty, 2)}
              </span>
              <span role="cell" className={cx('text-right font-mono tabular text-num', tone)}>
                {l.varianceQty === null ? '··' : `${l.varianceQty > 0 ? '+' : ''}${formatQty(l.varianceQty, 2)}`}
              </span>
              <span role="cell" className="text-right">
                {l.varianceCents === null ? null : <Money value={l.varianceCents} currency={false} decimals="whole" tone={l.outside ? 'default' : 'muted'} />}
              </span>
              <span role="cell" className="min-w-0">
                {l.outside && editable ? (
                  <div className="flex flex-col gap-8">
                    <TextField
                      label={`Reason for ${l.name}`}
                      hideLabel
                      size="md"
                      placeholder="What happened (at least 10 characters)"
                      value={reasons[l.id] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setReasons((r) => ({ ...r, [l.id]: value }));
                      }}
                      error={notice && !checkReason(reasons[l.id] ?? '').ok ? 'Needs at least 10 characters.' : undefined}
                    />
                    <div className="flex flex-wrap gap-4">
                      {QUICK.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setReasons((r) => ({ ...r, [l.id]: applyQuickReason(r[l.id] ?? '', q) }))}
                          className="h-control-sm rounded-sm bg-control px-8 text-body-sm text-ink-muted hover:bg-control-hover hover:text-ink"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-body text-ink-muted">{l.reason ?? (l.outside ? '' : 'Within tolerance')}</span>
                )}
              </span>
              <span role="cell" className="text-right">
                {editable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={IconArrowBackUp}
                    onClick={() =>
                      start(async () => {
                        const r = await recountLine({ countLineId: l.id });
                        if (!r.ok) setNotice(r.message);
                        else router.refresh();
                      })
                    }
                  >
                    Recount
                  </Button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-24 flex flex-wrap items-end justify-between gap-24">
        <div>
          <p className="text-label text-ink-subtle">Total variance at cost</p>
          <Money value={total} size="title-lg" decimals="always" />
        </div>
        {editable ? (
          <div className="flex items-center gap-16">
            {missing.length > 0 ? <span className="text-body text-low">{plural(missing.length, 'line')} outside tolerance still need a reason.</span> : null}
            <Button
              variant="primary"
              size="lg"
              loading={pending}
              onClick={() => {
                if (missing.length > 0) {
                  setNotice(`${plural(missing.length, 'line')} outside tolerance need a reason before the count commits.`);
                  return;
                }
                setNotice(null);
                setConfirm(true);
              }}
            >
              Commit count
            </Button>
          </div>
        ) : null}
      </div>

      <ConsoleOverlay
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Commit this count?"
        description={`${plural(lines.length, 'line')}, ${formatKes(total, { decimals: 'whole' })} total variance. Committing writes adjustments and locks the count.`}
        width="md"
      >
        <ReasonForm
          destructive={false}
          quickReasons={['Weekly count', 'Spot check', 'After a delivery']}
          confirmLabel="Commit count"
          onCancel={() => setConfirm(false)}
          onConfirm={async ({ reason }) => {
            const result = await commitCount({ countId, reasons, reason });
            if (!result.ok) throw new Error(result.message);
            setConfirm(false);
            router.refresh();
          }}
        />
      </ConsoleOverlay>
    </div>
  );
}
