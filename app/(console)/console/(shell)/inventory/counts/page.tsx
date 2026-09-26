import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconClipboardList } from '@tabler/icons-react';
import { ViewHeader } from '../../_components/workspace';
import { CountsTable } from './counts-table';

export const metadata: Metadata = { title: 'Counts' };

/** Stock counts: blind while counting, then reviewed line by line, then committed to the ledger. */
export default function CountsPage() {
  const locations = inventory.locations();
  const rows = inventory.counts().map((c) => {
    const lines = inventory.countLines(c.id);
    const counted = lines.lines.filter((l) => l.countedQty !== null).length;
    return {
      id: c.id,
      businessDate: c.businessDate,
      location: locations.find((l) => l.id === c.stockLocationId)?.name ?? '',
      kind: c.kind,
      status: c.status,
      counted,
      total: lines.lines.length,
      variance: c.totalVarianceCents,
      openedBy: identity.displayName(c.openedBy),
      openedAt: c.openedAt,
      committedAt: c.committedAt,
    };
  });
  return (
    <>
      <ViewHeader page="/console/inventory/counts" actions={<ButtonLink href="/console/inventory/counts/new" variant="primary" icon={IconClipboardList}>
            Start a count
          </ButtonLink>} />
      <CountsTable rows={rows} timezone={identity.outlet().timezone} />
    </>
  );
}
