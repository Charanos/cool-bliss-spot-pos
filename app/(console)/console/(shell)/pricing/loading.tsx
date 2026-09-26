import { MetricRowSkeleton, TableSkeleton } from '@bliss/ui/components/console/skeletons';

/** The view in waiting, in its own shape; the workspace header and tabs are already on screen. */
export default function PricingLoading() {
  return (
    <div aria-busy="true" aria-label="Loading pricing" className="flex flex-col gap-24">
      <MetricRowSkeleton count={2} />
      <TableSkeleton />
    </div>
  );
}
