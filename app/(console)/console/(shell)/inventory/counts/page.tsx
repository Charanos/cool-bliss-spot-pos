import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { CountsTable } from './counts-table';

export const metadata: Metadata = { title: 'Counts' };

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
  return <CountsTable rows={rows} timezone={identity.outlet().timezone} />;
}
