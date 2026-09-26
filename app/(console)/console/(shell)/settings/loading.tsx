import { TableSkeleton } from '@bliss/ui/components/console/skeletons';

/** The view in waiting, in its own shape; the workspace header and tabs are already on screen. */
export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="flex flex-col gap-24">
      <TableSkeleton />
    </div>
  );
}
