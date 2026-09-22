'use client';

import { formatElapsed, formatTime } from '@bliss/shared/format';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { SectionHeader } from '@bliss/ui/components/working';
import { useNow } from '@bliss/ui/hooks';
import { IconCheck, IconDoorExit } from '@tabler/icons-react';
import { useState } from 'react';
import { clear } from '@/lib/pos/actions';
import type { SeatedTab } from '@/lib/pos/queries';

/**
 * Paid, still seated. docs/16 section 8. Shared by the Floor's tab list and the Counter's.
 *
 * A settled tab does not vanish from its table the moment the bill is paid: the guests are usually
 * still finishing their drinks, and a table that shows as free while people sit at it gets a second
 * party walked to it. Each one here is a single tap to clear when they leave, with an undo, and
 * opening a new tab on the table clears it on its own.
 */
export function SeatedTabs({ tabs, timezone, onOpen }: { tabs: readonly SeatedTab[]; timezone: string; onOpen?: (tabId: string) => void }) {
  const now = useNow(30_000);
  const [clearing, setClearing] = useState<string | null>(null);
  if (tabs.length === 0) return null;

  return (
    <section aria-labelledby="seated-heading" className="mb-24">
      <SectionHeader id="seated-heading" title="Paid, still seated" count={tabs.length} className="mb-12" />
      <ul className="grid grid-cols-1 gap-8 compact:grid-cols-2 pad:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] pad:gap-12">
        {tabs.map((t) => (
          <li key={t.tab.id} className="flex items-center gap-12 rounded-[18px] border border-poured/25 bg-poured-wash/60 py-8 pl-12 pr-8 backdrop-blur-glass">
            <button
              type="button"
              onClick={() => onOpen?.(t.tab.id)}
              disabled={!onOpen}
              className="flex min-w-0 flex-1 items-center gap-12 text-left press-feedback"
            >
              <span className="flex size-control-md shrink-0 items-center justify-center rounded-dot bg-poured/15 text-poured">
                <IconCheck size={18} stroke={ICON_STROKE} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-body-lg text-ink">{t.label}</span>
                <span className="block truncate font-mono text-micro text-ink-subtle">
                  Paid {formatTime(t.settledFor, timezone)} · {formatElapsed(now - t.settledFor)} ago
                  {t.waiterName ? ` · ${t.waiterName}` : ''}
                </span>
              </span>
            </button>
            <Money value={t.paid} size="num-sm" tone="muted" decimals="whole" className="hidden shrink-0 compact:flex" />
            <button
              type="button"
              disabled={clearing === t.tab.id}
              onClick={async () => {
                setClearing(t.tab.id);
                await clear(t.tab.id, t.label);
                setClearing(null);
              }}
              aria-label={`Guests have left ${t.label}. Clear the table`}
              className="flex h-control-lg shrink-0 items-center gap-6 rounded-md bg-control px-12 text-body-sm font-medium text-ink press-feedback hover:bg-control-hover disabled:opacity-50"
            >
              <IconDoorExit size={16} stroke={ICON_STROKE} aria-hidden="true" />
              Clear
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
