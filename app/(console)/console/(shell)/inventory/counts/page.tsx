import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as reporting from '@/modules/reporting/service';
import { ViewHeader } from '../../_components/workspace';
import { type CountRow, CountsTable } from './counts-table';

export const metadata: Metadata = { title: 'Counts' };

/** Stock counts: blind while counting, then reviewed line by line, then committed to the ledger. */
export default function CountsPage() {
  const locations = inventory.locations();
  const rows: CountRow[] = inventory.counts().map((c) => {
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
      outside: lines.stage === 'blind' ? null : lines.lines.filter((l) => 'outsideTolerance' in l && l.outsideTolerance).length,
      openedBy: identity.displayName(c.openedBy),
      openedAt: c.openedAt,
      committedAt: c.committedAt,
    };
  });
  const last = reporting.latestCommittedVariance();
  const lastCount = [...inventory.counts()].filter((c) => c.status === 'committed').sort((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0))[0];
  return (
    <>
      <ViewHeader
        page="/console/inventory/counts"
        actions={
          <ButtonLink href="/console/inventory/counts/new" variant="create" icon={IconPlus}>
            Start a count
          </ButtonLink>
        }
      />
      <CountsTable rows={rows} timezone={identity.outlet().timezone} lastCommitted={last && lastCount ? { variance: last.total, outside: last.outside, at: lastCount.committedAt ?? lastCount.openedAt } : null} />
    </>
  );
}
