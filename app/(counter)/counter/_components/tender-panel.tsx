'use client';

import { type Cents, ZERO, compare, formatKes, isPositive, min, shillings, subtract, sum } from '@bliss/shared/money';
import { quickCashAmounts } from '@bliss/shared/settlement';
import { Eyebrow } from '@bliss/ui/components/atmosphere';
import { Button } from '@bliss/ui/components/button';
import { TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { AnimatedMoney, Money } from '@bliss/ui/components/money';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconBackspace, IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { TENDER_ICON, TENDER_WORD } from '@/app/_pos/tenders';
import { type TenderDraft, draftTender } from '@/lib/pos/counter';

export { TENDER_ICON, TENDER_WORD };

const KINDS = ['cash', 'mpesa', 'card'] as const;
type Kind = (typeof KINDS)[number];

/** Whole shillings typed on the keypad, capped at seven digits. */
function entryValue(entry: string): Cents | null {
  return entry === '' ? null : shillings(Number(entry));
}

/**
 * The tender panel. docs/14 section 6.
 *
 * One question at a time, top to bottom: how much, paid how, handed over what, and what goes back.
 * Cash takes what the guest handed over and works out the change as it is typed; M-Pesa and card
 * take an amount and an optional reference. Bliss records a tender. It does not check it with anyone
 * and never says a payment went through.
 *
 * A hardware keyboard at a desktop counter works the same as the keypad; Enter records.
 */
export function TenderPanel({
  due,
  tenders,
  onChange,
  drawerOpen,
  caption,
  disabled = false,
}: {
  due: Cents;
  tenders: readonly TenderDraft[];
  onChange: (next: TenderDraft[]) => void;
  drawerOpen: boolean;
  /** What the amount covers: "Whole tab", "Seat 2", "Share 1 of 3". */
  caption?: string;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<Kind>('cash');
  const [entry, setEntry] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorded = sum(tenders.map((t) => t.amount));
  const still = subtract(due, recorded);
  const covered = isPositive(due) && !isPositive(still);
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

  const record = (handed: Cents | null) => {
    if (covered) return;
    if (cashBlocked) return setError('Open the drawer before taking cash. M-Pesa and card can be recorded without it.');
    const figure = handed ?? typed ?? still;
    if (!isPositive(figure)) return setError('Enter an amount.');
    if (kind === 'cash') {
      onChange([...tenders, draftTender('cash', min(figure, still), figure, null)]);
    } else {
      if (compare(figure, still) > 0) return setError(`${TENDER_WORD[kind]} cannot be more than the ${formatKes(still, { decimals: 'whole' })} still due.`);
      if (kind === 'mpesa') {
        const cleanRef = reference.trim().toUpperCase();
        if (!cleanRef || cleanRef.length < 8) {
          return setError('Enter the M-Pesa code, at least 8 characters. Check it on the till statement, never on the guest\'s phone.');
        }
        onChange([...tenders, draftTender(kind, figure, null, cleanRef)]);
      } else if (kind === 'card') {
        const cleanRef = reference.trim();
        if (!cleanRef) {
          return setError('Card acquirer auth code or last four digits required.');
        }
        onChange([...tenders, draftTender(kind, figure, null, cleanRef)]);
      } else {
        onChange([...tenders, draftTender(kind, figure, null, reference.trim() || null)]);
      }
    }
    setEntry('');
    setReference('');
    setError(null);
  };

  useEffect(() => {
    if (disabled || covered) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Enter' && entry !== '') {
        event.preventDefault();
        record(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // record reads the latest state through the closure; re-bound when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, covered, entry, kind, reference, tenders, due, drawerOpen]);

  const shownFigure = typed ?? (covered ? ZERO : still);
  const change = kind === 'cash' && typed && compare(typed, still) > 0 && !covered ? subtract(typed, still) : null;
  const changeOnRecorded = sum(tenders.map((t) => (t.tendered ? subtract(t.tendered, t.amount) : ZERO)));

  return (
    <div className={cx('flex min-h-0 flex-col gap-16', disabled && 'pointer-events-none opacity-50')} aria-disabled={disabled || undefined}>
      {/* How much. */}
      <div className="flex items-end justify-between gap-12">
        <div className="min-w-0">
          <Eyebrow>{caption ? `Amount due · ${caption}` : 'Amount due'}</Eyebrow>
          <div className="mt-6">
            <AnimatedMoney value={due} size="display" tone={covered ? 'poured' : 'default'} animation="amount.change" />
          </div>
        </div>
        {tenders.length > 0 && !covered ? (
          <div className="shrink-0 text-right">
            <span className="caps text-ink-subtle">Still due</span>
            <div>
              <Money value={still} size="num-lg" tone="attention" />
            </div>
          </div>
        ) : null}
      </div>

      {tenders.length > 0 ? (
        <ul aria-label="Recorded tenders" className="flex flex-col gap-4">
          {tenders.map((t) => {
            const Glyph = TENDER_ICON[t.kind];
            return (
              <li key={t.id} className="flex min-h-row items-center gap-12 rounded-md bg-sunken/60 px-12">
                <Glyph size={18} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                <span className="w-[64px] shrink-0 text-body text-ink">{TENDER_WORD[t.kind]}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-num-sm text-ink-subtle">
                  {t.kind === 'cash' && t.tendered && compare(t.tendered, t.amount) > 0 ? `Handed ${formatKes(t.tendered, { decimals: 'whole' })}` : (t.reference ?? '')}
                </span>
                <Money value={t.amount} size="num" />
                <button
                  type="button"
                  aria-label={`Remove the ${TENDER_WORD[t.kind]} tender of ${formatKes(t.amount)}`}
                  onClick={() => onChange(tenders.filter((x) => x.id !== t.id))}
                  className="-mr-8 flex size-control-md shrink-0 items-center justify-center rounded-sm text-ink-subtle press-feedback hover:bg-control hover:text-ink"
                >
                  <IconX size={16} stroke={ICON_STROKE} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {covered ? (
        <div className="flex flex-col gap-12 rounded-lg bg-poured-wash px-16 py-16">
          <p className="flex items-center gap-8 text-body text-poured">
            <IconCheck size={18} stroke={ICON_STROKE} aria-hidden="true" />
            Covered. Settle to finish.
          </p>
          {isPositive(changeOnRecorded) ? (
            <div>
              <span className="caps text-ink-subtle">Change to give</span>
              <Money value={changeOnRecorded} size="display" tone="money" decimals="whole" />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* Paid how. Three tiles, because at a busy counter a segmented control is too small a target. */}
          <div role="radiogroup" aria-label="Paid by" className="grid grid-cols-3 gap-8">
            {KINDS.map((k) => {
              const Glyph = TENDER_ICON[k];
              const selected = kind === k;
              const blocked = k === 'cash' && !drawerOpen;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setKind(k);
                    setError(null);
                  }}
                  className={cx(
                    'relative flex h-control-xl flex-col items-center justify-center gap-4 rounded-md press-feedback',
                    selected ? 'bg-accent/15 text-accent-text' : 'bg-sunken/60 text-ink-muted hover:bg-control hover:text-ink',
                  )}
                >
                  <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" />
                  <span className="text-label">{TENDER_WORD[k]}</span>
                  {blocked ? (
                    <span className="absolute right-6 top-6">
                      <Dot tone="low" />
                      <span className="sr-only">, the drawer is not open</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {cashBlocked ? (
            <p className="flex items-center gap-8 rounded-md bg-low/10 px-12 py-8 text-body-sm text-low">
              <Dot tone="low" />
              Open the drawer to take cash. M-Pesa and card work without it.
            </p>
          ) : null}

          {/* Handed over what, and what goes back. */}
          <div className="flex items-end justify-between gap-12 rounded-md bg-sunken/60 px-16 py-12">
            <div className="min-w-0">
              <span className="caps text-ink-subtle">{kind === 'cash' ? 'Handed over' : 'Amount'}</span>
              <div aria-live="polite">
                <Money value={shownFigure} size="num-xl" tone={typed ? 'default' : 'subtle'} decimals="whole" />
              </div>
            </div>
            {change ? (
              <div className="shrink-0 text-right">
                <span className="caps text-ink-subtle">Change</span>
                <div>
                  <Money value={change} size="num-lg" tone="money" decimals="whole" />
                </div>
              </div>
            ) : null}
          </div>

          {kind === 'cash' ? (
            <div className="flex flex-wrap gap-8" role="group" aria-label="Quick cash amounts">
              {quickCashAmounts(still).map((amount, i) => (
                <button
                  key={amount.toString()}
                  type="button"
                  disabled={cashBlocked}
                  onClick={() => record(amount)}
                  className="h-control-md flex-1 rounded-dot bg-control px-12 font-mono tabular text-num-sm text-ink press-feedback hover:bg-control-hover disabled:opacity-40"
                >
                  {i === 0 ? 'Exact' : formatKes(amount, { decimals: 'whole' })}
                </button>
              ))}
            </div>
          ) : (
            <TextField
              label={kind === 'mpesa' ? 'M-Pesa Transaction Ref (e.g. SJK4H2X9PQ)' : 'Acquirer Batch / Auth Code'}
              helper={
                kind === 'mpesa'
                  ? 'Verify on Till / API statement.'
                  : 'Card acquirer batch sequence or approval auth code.'
              }
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase().slice(0, 40))}
              mono
              size="md"
              autoComplete="off"
              placeholder={kind === 'mpesa' ? 'SJK4H2X9PQ' : 'Auth / Last 4'}
            />
          )}

          <div className="grid grid-cols-3 gap-8" role="group" aria-label="Amount keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === 'back' ? 'Delete the last digit' : key}
                className="surface-key flex h-control-lg items-center justify-center rounded-md font-mono tabular text-num-lg text-ink tall:h-control-xl"
              >
                {key === 'back' ? <IconBackspace size={22} stroke={ICON_STROKE} aria-hidden="true" /> : key}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="text-body-sm text-stop">
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
