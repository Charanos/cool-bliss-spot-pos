import { formatDateTime } from '@bliss/shared/format';
import { abs, compare, isPositive, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { EmptyState } from '@bliss/ui/components/feedback';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import { PourVarianceView } from './pour-variance-view';

export const metadata: Metadata = { title: 'Pour variance' };

/**
 * N-07 and R9: between the last two full counts of the bar shelf, what should have gone out in sold
 * serves against what the counts say went out, in bottles, millilitres and money at cost.
 */
export default async function PourVariancePage() {
  const actor = await identity.currentConsoleActor();
  const tz = identity.outlet().timezone;
  const { from, to, rows } = reporting.pourVariance();
  if (!from || !to) {
    return (
      <EmptyState
        title="Two full counts are needed"
        body="Pour variance compares sold serves with the change between two full counts of the bar shelf. Commit a second count to see it."
        action={<ButtonLink href="/console/inventory/counts/new">Start a count</ButtonLink>}
      />
    );
  }
  // More out than sold is what cost money; under-pouring is shown in the table but not added here.
  const lost = sum(rows.filter((r) => isPositive(r.varianceCents)).map((r) => r.varianceCents));
  const worst = [...rows].sort((a, b) => compare(abs(b.varianceCents), abs(a.varianceCents)))[0] ?? null;

  return (
    <PourVarianceView
      period={`${formatDateTime(from, tz)} to ${formatDateTime(to, tz)}`}
      rows={rows}
      lost={lost}
      outside={rows.filter((r) => r.outside).length}
      worst={worst ? { name: worst.name, ml: worst.varianceMl } : null}
      canSeeCost={identity.can(actor.staffId, 'report.margin')}
    />
  );
}
