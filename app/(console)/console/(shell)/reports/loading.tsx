import { Skeleton } from '@bliss/ui/components/feedback';

/** A report arrives as figures, a chart and a table, so the skeleton has the same three parts. */
export default function ReportsLoading() {
  return (
    <div aria-busy="true" aria-label="Reading the report">
      <div className="grid grid-cols-2 gap-16 desktop:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[112px]" />
        ))}
      </div>
      <Skeleton className="mt-16 h-[280px]" />
      <div className="mt-16 flex flex-col gap-8">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[20px]" style={{ width: `${90 - i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}
