import { MetricRowSkeleton, TableSkeleton } from '@bliss/ui/components/console/skeletons';

/** The view in waiting, in its own shape; the workspace header and tabs are already on screen. */
export default function TradeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading trade" className="flex flex-col gap-24">
      <MetricRowSkeleton count={4} />
      <TableSkeleton />
    </div>
  );
}
