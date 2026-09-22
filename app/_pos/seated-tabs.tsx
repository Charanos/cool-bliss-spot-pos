'use client';

import { formatElapsed } from '@bliss/shared/format';
import { CardAction } from '@bliss/ui/components/card-action';
import { TabCard } from '@bliss/ui/components/floor/tab-card';
import { SectionHeader } from '@bliss/ui/components/working';
import { useNow } from '@bliss/ui/hooks';
import { IconDoorExit } from '@tabler/icons-react';
import { clear } from '@/lib/pos/actions';
import type { SeatedTab } from '@/lib/pos/queries';
import { STAGE } from './table-stage';

const LAYOUT = {
  /** A page's own grid, beside or above the open tabs. */
  grid: 'grid grid-cols-2 gap-8 pad:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] pad:gap-16',
  /** The Floor's open tabs rail: two across on a phone, one column in the rail from a tablet. */
  rail: 'grid grid-cols-2 gap-8 tablet:flex tablet:flex-col tablet:gap-12',
} as const;

/**
 * Paid, still seated. docs/16 section 8. Shared by the Floor's tab list and the Counter's.
 *
 * A settled tab does not vanish from its table the moment the bill is paid: the guests are usually
 * still finishing their drinks, and a table that shows as free while people sit at it gets a second
 * party walked to it. So a paid table keeps its card, reads "Paid, still seated", and carries the
 * one thing left to do across its foot: clear the table, with an undo. Opening a new tab on the
 * table clears it on its own.
 */
export function SeatedTabs({ tabs, staffId, onOpen, className, layout = 'grid' }: { tabs: readonly SeatedTab[]; staffId?: string | null; onOpen?: (tabId: string) => void; className?: string; layout?: keyof typeof LAYOUT }) {
  const now = useNow(30_000);
  if (tabs.length === 0) return null;

  return (
    <section aria-labelledby="seated-heading" className={className ?? 'mb-24'}>
      <SectionHeader id="seated-heading" title="Paid, still seated" count={tabs.length} className="mb-12" />
      <div className={LAYOUT[layout]}>
        {tabs.map((t) => (
          <TabCard
            key={t.tab.id}
            tableLabel={t.label}
            name={t.tab.name}
            seats={[]}
            showSeats={false}
            elapsed={formatElapsed(now - t.settledFor)}
            elapsedLabel={`paid ${formatElapsed(now - t.settledFor)} ago`}
            total={t.paid}
            waiter={t.waiterName}
            mine={Boolean(staffId) && t.tab.assignedTo === staffId}
            unsentCount={0}
            ranOutCount={0}
            onOpen={() => onOpen?.(t.tab.id)}
            stage={STAGE.seated}
            action={<CardAction label="Clear table" icon={IconDoorExit} tone="quiet" ariaLabel={`Guests have left ${t.label}. Clear the table`} onClick={() => clear(t.tab.id, t.label)} />}
          />
        ))}
      </div>
    </section>
  );
}
