import { PageSkeleton } from '@bliss/ui/components/console/skeletons';

/** The overview in waiting: its header, the four figures, then the two panels. */
export default function OverviewLoading() {
  return <PageSkeleton label="Loading the overview" metrics={4} body="cards" />;
}
