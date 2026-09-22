'use client';

import { multiplyByQty } from '@bliss/shared/money';
import { DENOMINATIONS } from '@bliss/shared/settlement';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconMinus, IconPlus } from '@tabler/icons-react';

export type Counts = Readonly<Record<string, number>>;

/**
 * Kenyan notes and coins, largest first, each with a count and what it comes to. docs/14 section 7.
 *
 * Counting a drawer is typing, mostly: thirty seven hundreds is not thirty seven taps. So each row
 * takes a number typed straight in, with a minus and a plus either side for the last few coins, and
 * the row's own total beside it so a miscount shows while it is still being made.
 */
export function DenominationCounter({ counts, onChange, label }: { counts: Counts; onChange: (next: Record<string, number>) => void; label: string }) {
  const set = (key: string, value: number) => onChange({ ...counts, [key]: Math.max(0, Math.min(9999, Math.floor(value || 0))) });

  return (
    <ul aria-label={label} className="flex flex-col">
      {DENOMINATIONS.map((d, i) => {
        const n = counts[d.key] ?? 0;
        const firstCoin = d.kind === 'coin' && DENOMINATIONS[i - 1]?.kind === 'note';
        return (
          <li key={d.key} className={cx('flex min-h-row-floor items-center gap-12 px-16', firstCoin ? 'border-t border-rule-raised/40' : 'border-t border-rule-raised/15 first:border-t-0')}>
            <span className="flex w-[88px] shrink-0 items-baseline gap-8">
              <span className="font-mono tabular text-num-lg text-ink">{d.label}</span>
              <span className="caps text-ink-subtle">{d.kind}</span>
            </span>

            <span className="flex flex-1 items-center justify-center gap-4">
              <button
                type="button"
                aria-label={`One fewer ${d.label}`}
                disabled={n === 0}
                onClick={() => set(d.key, n - 1)}
                className="flex size-control-md shrink-0 items-center justify-center rounded-dot bg-control text-ink press-feedback hover:bg-control-hover disabled:opacity-30"
              >
                <IconMinus size={16} stroke={ICON_STROKE} aria-hidden="true" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`How many ${d.label} ${d.kind}s`}
                value={n === 0 ? '' : String(n)}
                placeholder="0"
                onChange={(e) => set(d.key, Number(e.target.value.replace(/[^0-9]/g, '')))}
                onFocus={(e) => e.currentTarget.select()}
                className="h-control-md w-[72px] rounded-sm bg-sunken/60 text-center font-mono tabular text-num-lg text-ink outline-none placeholder:text-ink-disabled focus:bg-sunken"
              />
              <button
                type="button"
                aria-label={`One more ${d.label}`}
                onClick={() => set(d.key, n + 1)}
                className="flex size-control-md shrink-0 items-center justify-center rounded-dot bg-control text-ink press-feedback hover:bg-control-hover"
              >
                <IconPlus size={16} stroke={ICON_STROKE} aria-hidden="true" />
              </button>
            </span>

            <Money value={multiplyByQty(d.value, n)} size="num" tone={n > 0 ? 'default' : 'disabled'} decimals="whole" className="w-[108px] shrink-0 justify-end" />
          </li>
        );
      })}
    </ul>
  );
}
