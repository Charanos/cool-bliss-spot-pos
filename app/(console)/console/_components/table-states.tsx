'use client';

import { Button } from '@bliss/ui/components/button';
import { Skeleton } from '@bliss/ui/components/feedback';
import { Dot } from '@bliss/ui/components/status';

/** Loading skeleton in the shape of a table: filter bar, header, rows. Never a centred spinner. */
export function TableSkeleton({ rows = 10, label = 'Reading the table' }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="flex gap-16 pb-16">
        <Skeleton className="h-[48px] w-[180px]" />
        <Skeleton className="h-[48px] w-[180px]" />
        <Skeleton className="ml-auto h-[40px] w-[120px]" />
      </div>
      <Skeleton className="h-[36px] w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-row items-center gap-16 border-b border-rule px-16">
          <Skeleton className="h-[16px] w-[28%]" />
          <Skeleton className="h-[16px] w-[14%]" />
          <Skeleton className="ml-auto h-[16px] w-[10%]" />
          <Skeleton className="h-[16px] w-[10%]" />
        </div>
      ))}
    </div>
  );
}

/** The fourth table state: an error that says what happened, what is safe and what to do. */
export function TableError({ reset, what }: { reset: () => void; what: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-12 py-40">
      <p className="flex items-center gap-8 text-subtitle text-ink">
        <Dot tone="stop" />
        {what} could not load.
      </p>
      <p className="text-body text-ink-muted">Nothing was changed. The data is safe; this view could not read it just now.</p>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
