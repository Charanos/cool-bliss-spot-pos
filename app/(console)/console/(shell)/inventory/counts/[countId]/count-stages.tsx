'use client';

import type { CountStatus } from '@bliss/shared/domain';
import { formatQty, plural } from '@bliss/shared/format';
import { type Cents, ZERO, add, formatKes } from '@bliss/shared/money';
import { applyQuickReason, checkReason } from '@bliss/shared/reason';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader } from '@bliss/ui/components/console/card';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice, Progress } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowBackUp } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { commitCount, recordCounted, recountLine, submitForReview } from '../../../_actions/inventory';
import { useToast } from '@bliss/ui/components/console/toast';

interface BlindLine {
  id: string;
  name: string;
  category: string;
  unit: string;
  countedQty: number | null;
}

/**
 * Counting: a list of lines with a large numeric input each, usable on a tablet at 1024 wide.
 * There is no expected column because the page never received an expected figure.
 */
export function CountBlind({ countId, lines }: { countId: string; lines: BlindLine[] }) {
  const router = useRouter();
  const notify = useToast();
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
    <div className="flex flex-col gap-16">
      <Card aria-labelledby="count-lines">
        <CardHeader band level="h2" titleId="count-lines" title="Count what is there" subtitle="Part bottles in tenths: 0.4 is a bottle a little under half full. Each figure saves as you leave it." />
        <ul className="flex flex-col">
          {lines.map((line) => {
            const state = saving[line.id];
            return (
              <li key={line.id} className="grid grid-cols-[minmax(200px,1fr)_88px_176px_88px] items-center gap-16 border-b border-rule px-20 py-8 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-ui font-medium text-ink">{line.name}</span>
                  <span className="block text-body-sm text-ink-subtle">{line.category}</span>
                </span>
                <span className="text-body-sm text-ink-muted">{line.unit}</span>
                <input
                  aria-label={`Counted ${line.unit} of ${line.name}`}
                  inputMode="decimal"
                  value={values[line.id] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setValues((v) => ({ ...v, [line.id]: value }));
                  }}
                  onBlur={() => void save(line)}
                  placeholder="Not counted"
                  className={cx(
                    'h-control-lg w-full rounded-md border bg-transparent px-12 text-right font-mono tabular text-num-lg text-ink outline-none transition-hover placeholder:font-sans placeholder:text-body-sm placeholder:text-ink-subtle focus:border-accent',
                    state === 'error' ? 'border-stop' : 'border-edge-strong',
                  )}
                />
                <span className={cx('text-body-sm', state === 'error' ? 'text-stop' : state === 'saved' ? 'text-poured' : 'text-ink-subtle')} aria-live="polite">
                  {state === 'saving' ? 'Saving' : state === 'saved' ? 'Saved' : state === 'error' ? 'Zero or more' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="sticky bottom-0 z-sticky flex flex-wrap items-center gap-24 rounded-card px-20 py-12 card-surface shadow-popover">
        <Progress value={counted} max={lines.length} label={`${counted} of ${lines.length} counted`} className="min-w-0 flex-1" />
        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
        <Button
          variant="primary"
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await submitForReview({ countId });
              if (!result.ok) setError(result.message);
              else {
                notify({ title: 'Sent for review', body: 'The variance shows once a manager opens it.' });
                router.refresh();
              }
            })
          }
        >
          Send for review
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
export function CountReview({ countId, status, lines }: { countId: string; status: CountStatus; lines: ReviewLine[] }) {
  const router = useRouter();
  const notify = useToast();
  const editable = status === 'review';
  const [reasons, setReasons] = useState<Record<string, string>>(() => Object.fromEntries(lines.filter((l) => l.outside).map((l) => [l.id, l.reason ?? ''])));
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const total = useMemo(() => lines.reduce((sum, l) => add(sum, l.varianceCents ?? ZERO), ZERO), [lines]);
  const missing = lines.filter((l) => l.outside && !checkReason(reasons[l.id] ?? '').ok);
  const outside = lines.filter((l) => l.outside).length;
  const ordered = [...lines].sort((a, b) => Number(b.outside) - Number(a.outside) || Math.abs(b.varianceQty ?? 0) - Math.abs(a.varianceQty ?? 0));
  const head = 'px-12 py-12 text-label text-ink-subtle';

  return (
    <div className="flex flex-col gap-24">
      {notice ? <InlineNotice tone="stop">{notice}</InlineNotice> : null}
      <Card aria-labelledby="count-review">
        <CardHeader
          band
          level="h2"
          titleId="count-review"
          title={editable ? 'Review' : 'What was counted'}
          subtitle={outside > 0 ? `${plural(outside, 'line')} outside tolerance${editable ? ', each needs a reason' : ''}` : 'Every line within tolerance'}
        />
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <caption className="sr-only">Count review</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`${head} pl-20 text-left`}>
                  Item
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Expected
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Counted
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Variance
                </th>
                <th scope="col" className={`${head} text-right`}>
                  At cost
                </th>
                <th scope="col" className={`${head} w-[36%] text-left`}>
                  Reason
                </th>
                <th scope="col" className="pr-20">
                  <span className="sr-only">Recount</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((l) => {
                const tone = l.varianceQty === null || l.varianceQty === 0 ? 'text-ink-subtle' : !l.outside ? 'text-poured' : l.varianceQty < 0 ? 'text-stop' : 'text-low';
                return (
                  <tr key={l.id} className="border-b border-rule align-top last:border-b-0">
                    <td className="py-12 pl-20 pr-12">
                      <span className="block truncate text-ui text-ink">{l.name}</span>
                      <span className="block text-body-sm text-ink-subtle">
                        {l.category}, within {l.tolerancePct}%
                      </span>
                    </td>
                    <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(l.expectedQty, 2)}</td>
                    <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{l.countedQty === null ? 'None' : formatQty(l.countedQty, 2)}</td>
                    <td className={cx('px-12 py-12 text-right font-mono tabular text-num-md', tone)}>{l.varianceQty === null ? 'None' : `${l.varianceQty > 0 ? '+' : ''}${formatQty(l.varianceQty, 2)}`}</td>
                    <td className="px-12 py-12 text-right">{l.varianceCents === null ? null : <Money value={l.varianceCents} currency={false} size="num-md" decimals="whole" tone={l.outside ? 'default' : 'muted'} />}</td>
                    <td className="px-12 py-12">
                      {l.outside && editable ? (
                        <div className="flex flex-col gap-8">
                          <TextField
                            label={`Reason for ${l.name}`}
                            hideLabel
                            size="md"
                            placeholder="What happened, in a sentence"
                            value={reasons[l.id] ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setReasons((r) => ({ ...r, [l.id]: value }));
                            }}
                            error={notice && !checkReason(reasons[l.id] ?? '').ok ? 'At least 10 characters.' : undefined}
                          />
                          <div className="flex flex-wrap gap-4">
                            {QUICK.map((q) => (
                              <Button key={q} type="button" size="xs" variant="outline" onClick={() => setReasons((r) => ({ ...r, [l.id]: applyQuickReason(r[l.id] ?? '', q) }))}>
                                {q}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-body-sm text-ink-muted">{l.reason ?? (l.outside ? 'No reason given' : 'Within tolerance')}</span>
                      )}
                    </td>
                    <td className="py-12 pl-12 pr-20 text-right">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CardFooter>
          <span className="text-body-sm text-ink-muted">Total variance at cost</span>
          <Money value={total} size="num-lg" />
        </CardFooter>
      </Card>

      {editable ? (
        <div className="sticky bottom-0 z-sticky flex flex-wrap items-center justify-end gap-16 rounded-card px-20 py-12 card-surface shadow-popover">
          {missing.length > 0 ? <span className="text-body-sm text-low">{plural(missing.length, 'line')} outside tolerance still need a reason.</span> : null}
          <Button
            variant="primary"
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
            Commit the count
          </Button>
        </div>
      ) : null}

      <ConsoleOverlay
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Commit this count?"
        description={`${plural(lines.length, 'line')}, ${formatKes(total, { decimals: 'whole' })} total variance. Committing writes the adjustments to the stock ledger and locks the count.`}
        width="md"
      >
        <ReasonForm
          destructive={false}
          quickReasons={['Weekly count', 'Spot check', 'After a delivery']}
          confirmLabel="Commit the count"
          onCancel={() => setConfirm(false)}
          onConfirm={async ({ reason }) => {
            const result = await commitCount({ countId, reasons, reason });
            if (!result.ok) throw new Error(result.message);
            setConfirm(false);
            notify({ title: 'Count committed', body: 'Stock now reads as counted.' });
            router.refresh();
          }}
        />
      </ConsoleOverlay>
    </div>
  );
}
