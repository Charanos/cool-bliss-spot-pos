'use client';

import type { TenderKind } from '@bliss/shared/domain';
import { type Cents, ZERO, compare, formatKes, isPositive, min, shillings, subtract, sum } from '@bliss/shared/money';
import { quickCashAmounts } from '@bliss/shared/settlement';
import { Button } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { Eyebrow } from '@bliss/ui/components/atmosphere';
import { cx } from '@bliss/ui/lib/cx';
import { IconBackspace, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { type TenderDraft, draftTender } from '@/lib/pos/counter';

export const TENDER_WORD: Record<TenderKind, string> = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', account: 'Account', comp: 'Complimentary' };

const KINDS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'card', label: 'Card' },
] as const;

type Kind = (typeof KINDS)[number]['value'];

/** Whole shillings typed on the keypad, capped at seven digits. */
function entryValue(entry: string): Cents | null {
  return entry === '' ? null : shillings(Number(entry));
}

/**
 * The tender panel. docs/14 section 6. The amount due, how it is being paid, and what is still due.
 * Cash takes what the guest handed over and works out the change; M-Pesa and card take an amount and
 * an optional reference. Bliss records a tender. It does not check it with anyone.
 */
export function TenderPanel({
  due,
  tenders,
  onChange,
  drawerOpen,
  disabled = false,
}: {
  due: Cents;
  tenders: readonly TenderDraft[];
  onChange: (next: TenderDraft[]) => void;
  drawerOpen: boolean;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<Kind>('cash');
  const [entry, setEntry] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorded = sum(tenders.map((t) => t.amount));
  const still = subtract(due, recorded);
  const covered = !isPositive(still);
  const typed = entryValue(entry);
  const cashBlocked = kind === 'cash' && !drawerOpen;

  // The amount due can move under the panel when a line is voided elsewhere; typed figures stay, errors go.
  useEffect(() => setError(null), [due]);

  const press = (key: string) => {
    setError(null);
    if (key === 'back') return setEntry((e) => e.slice(0, -1));
    setEntry((e) => {
      const next = (e + key).replace(/^0+/, '');
      return next.length > 7 ? e : next;
    });
  };

  // Typing on a hardware keyboard at a desktop counter works the same as the keypad.
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  const record = (handed: Cents | null) => {
    if (covered) return;
    if (cashBlocked) return setError('Open the drawer before taking cash. M-Pesa and card can be recorded without it.');
    const figure = handed ?? typed ?? still;
    if (!isPositive(figure)) return setError('Enter an amount.');
    if (kind === 'cash') {
      onChange([...tenders, draftTender('cash', min(figure, still), figure, null)]);
    } else {
      if (compare(figure, still) > 0) return setError(`${TENDER_WORD[kind]} cannot be more than the ${formatKes(still, { decimals: 'whole' })} still due.`);
      onChange([...tenders, draftTender(kind, figure, null, reference)]);
    }
    setEntry('');
    setReference('');
    setError(null);
  };

  const shownFigure = typed ?? (covered ? ZERO : still);
  const change = kind === 'cash' && typed && compare(typed, still) > 0 && !covered ? subtract(typed, still) : null;
  const changeOnRecorded = sum(tenders.map((t) => (t.tendered ? subtract(t.tendered, t.amount) : ZERO)));

  return (
    <div className={cx('flex min-h-0 flex-col gap-16', disabled && 'pointer-events-none opacity-60')} aria-disabled={disabled || undefined}>
      <div>
        <Eyebrow>Amount due</Eyebrow>
        <div className="mt-4">
          <AnimatedMoney value={due} size="display" animation="amount.change" />
        </div>
        {tenders.length > 0 ? (
          <p className="mt-4 flex items-baseline gap-8 text-body text-ink-muted">
            {covered ? 'Covered' : 'Still due'}
            {covered ? null : <Money value={still} size="num-lg" tone="attention" />}
          </p>
        ) : null}
      </div>

      {tenders.length > 0 ? (
        <ul aria-label="Recorded tenders" className="flex flex-col border-y border-rule">
          {tenders.map((t) => (
            <li key={t.id} className="flex min-h-row items-center gap-12 border-b border-rule last:border-b-0">
              <span className="w-[72px] shrink-0 text-body text-ink">{TENDER_WORD[t.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-body-sm text-ink-subtle">
                {t.kind === 'cash' && t.tendered && compare(t.tendered, t.amount) > 0 ? `Handed ${formatKes(t.tendered, { decimals: 'whole' })}` : (t.reference ?? '')}
              </span>
              <Money value={t.amount} size="num" />
              <button
                type="button"
                aria-label={`Remove the ${TENDER_WORD[t.kind]} tender of ${formatKes(t.amount)}`}
                onClick={() => onChange(tenders.filter((x) => x.id !== t.id))}
                className="flex size-control-md shrink-0 items-center justify-center rounded-sm text-ink-subtle press-feedback hover:bg-control hover:text-ink"
              >
                <IconX size={18} stroke={ICON_STROKE} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {covered ? (
        changeOnRecorded > 0n ? (
          <div className="rounded-md border border-rule bg-raised px-16 py-12">
            <Eyebrow>Change due</Eyebrow>
            <Money value={changeOnRecorded} size="num-xl" tone="money" />
          </div>
        ) : null
      ) : (
        <>
          <Segmented label="Paid by" size="lg" options={KINDS} value={kind} onChange={(k) => (setKind(k), setError(null))} className="self-start" />

          {cashBlocked ? <InlineNotice tone="low">The drawer is not open on this counter. Open it to take cash.</InlineNotice> : null}

          <div className="flex items-end justify-between gap-12 border-b border-rule-raised pb-8">
            <div className="min-w-0">
              <span className="text-label text-ink-subtle">{kind === 'cash' ? 'Handed over' : 'Amount'}</span>
              <div aria-live="polite">
                <Money value={shownFigure} size="num-xl" tone={typed ? 'default' : 'subtle'} decimals="whole" />
              </div>
            </div>
            {change ? (
              <div className="text-right">
                <span className="text-label text-ink-subtle">Change</span>
                <div>
                  <Money value={change} size="num-lg" tone="money" decimals="whole" />
                </div>
              </div>
            ) : null}
          </div>

          {kind === 'cash' ? (
            <div className="flex flex-wrap gap-8" role="group" aria-label="Quick cash amounts">
              {quickCashAmounts(still).map((amount, i) => (
                <Button key={amount.toString()} variant="secondary" size="lg" disabled={cashBlocked} onClick={() => record(amount)}>
                  {i === 0 ? 'Exact' : formatKes(amount, { decimals: 'whole' })}
                </Button>
              ))}
            </div>
          ) : (
            <TextField
              label="Reference"
              helper="Bliss records this. It does not check it."
              value={reference}
              onChange={(e) => setReference(e.target.value.slice(0, 40))}
              mono
              autoComplete="off"
              placeholder={kind === 'mpesa' ? 'SJK4H2X9PQ' : 'Last four digits'}
            />
          )}

          <div className="grid grid-cols-3 gap-8" role="group" aria-label="Amount keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === 'back' ? 'Delete the last digit' : key}
                className="surface-key flex h-control-xl items-center justify-center rounded-md font-mono tabular text-num-lg text-ink"
              >
                {key === 'back' ? <IconBackspace size={24} stroke={ICON_STROKE} aria-hidden="true" /> : key}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-body text-stop">
              {error}
            </p>
          ) : null}

          <Button variant="tender" size="xl" fullWidth disabled={cashBlocked} onClick={() => record(null)}>
            Record {kind === 'mpesa' ? 'M-Pesa' : TENDER_WORD[kind].toLowerCase()} · {formatKes(kind === 'cash' ? min(shownFigure, still) : shownFigure, { decimals: 'whole' })}
          </Button>
        </>
      )}
    </div>
  );
}
