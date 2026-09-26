import { CardGridSkeleton, MetricRowSkeleton } from '@bliss/ui/components/console/skeletons';

/** The view in waiting, in its own shape; the workspace header and tabs are already on screen. */
export default function PeopleLoading() {
  return (
    <div aria-busy="true" aria-label="Loading people" className="flex flex-col gap-24">
      <MetricRowSkeleton count={4} />
      <CardGridSkeleton />
    </div>
  );
}
