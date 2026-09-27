import { cx } from '../../lib/cx';
import { Skeleton } from '../feedback';

/**
 * Loading states in the shape of what is coming, so nothing moves when the data lands. Static: no
 * shimmer, per docs/07. Each carries aria-busy and a label saying what is loading.
 */

export function PageHeaderSkeleton({ tabs = 0 }: { tabs?: number }) {
  return (
    <div className="flex flex-col gap-12 pb-24">
      <Skeleton className="h-32 w-kpi-min" />
      <Skeleton className="h-16 w-search" />
      {tabs > 0 ? (
        <div className="mt-12 flex gap-24 border-b border-rule pb-12">
          {Array.from({ length: tabs }, (_, i) => (
            <Skeleton key={i} className="h-16 w-72" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MetricRowSkeleton({ count = 4 }: { count?: 2 | 3 | 4 }) {
  return (
    <div className={cx('grid grid-cols-1 gap-16 pad:grid-cols-2', count === 4 ? 'desktop:grid-cols-4' : count === 3 ? 'desktop:grid-cols-3' : null)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-kpi-min flex-col justify-between gap-16 card-surface p-20">
          <Skeleton className="h-16 w-96" />
          <Skeleton className="h-32 w-kpi-min" />
          <Skeleton className="h-12 w-72" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-16 card-surface p-20', className)}>
      <div className="flex items-center gap-12">
        <Skeleton className="size-control-sm" />
        <Skeleton className="h-16 w-kpi-min" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx('h-12', i % 3 === 2 ? 'w-1/2' : 'w-full')} />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A table in waiting: its toolbar, its header and its rows. Never a centred spinner. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="flex items-center gap-8">
        <Skeleton className="h-control-sm w-kpi-min" />
        <Skeleton className="h-control-sm w-kpi-min" />
        <Skeleton className="ml-auto h-control-sm w-96" />
      </div>
      <div className="card-surface">
        <div className="flex h-row items-center gap-16 border-b border-edge card-band px-20">
          <Skeleton className="h-12 w-1/4" />
          <Skeleton className="h-12 w-1/6" />
          <Skeleton className="ml-auto h-12 w-1/12" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-row items-center gap-16 border-b border-rule px-20 last:border-b-0">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-12 w-1/6" />
            <Skeleton className="ml-auto h-12 w-1/12" />
            <Skeleton className="h-12 w-1/12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A whole page in waiting: header, optional metrics, then a table or a card grid. */
export function PageSkeleton({ label, tabs = 0, metrics = 0, body = 'table' }: { label: string; tabs?: number; metrics?: 0 | 2 | 3 | 4; body?: 'table' | 'cards' | 'none' }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-32">
      <PageHeaderSkeleton tabs={tabs} />
      {metrics ? <MetricRowSkeleton count={metrics} /> : null}
      {body === 'table' ? <TableSkeleton /> : body === 'cards' ? <CardGridSkeleton /> : null}
    </div>
  );
}
