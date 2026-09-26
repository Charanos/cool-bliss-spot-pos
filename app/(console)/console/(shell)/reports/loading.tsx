import { MetricRowSkeleton } from '@bliss/ui/components/console/skeletons';

/** The view in waiting, in its own shape; the workspace header and tabs are already on screen. */
export default function ReportsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading this report" className="flex flex-col gap-24">
      <MetricRowSkeleton count={4} />
      <div className="h-96" />
    </div>
  );
}
