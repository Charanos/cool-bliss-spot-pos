import { Skeleton } from '@bliss/ui/components/feedback';

/** The loading skeleton matches the overview exactly, never a centred spinner. docs/10 N1. */
export default function OverviewLoading() {
  return (
    <div aria-busy="true" aria-label="Reading last night">
      <Skeleton className="h-[34px] w-[200px]" />
      <Skeleton className="mt-8 h-[22px] w-[320px]" />
      <div className="mt-24 grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-12 rounded-md border border-hairline p-20">
            <Skeleton className="h-[15px] w-[96px]" />
            <Skeleton className="h-[34px] w-[160px]" />
            <Skeleton className="h-[19px] w-[120px]" />
          </div>
        ))}
      </div>
      <div className="mt-16 grid grid-cols-1 gap-16 desktop:grid-cols-[3fr_2fr]">
        <div className="rounded-md border border-hairline p-20">
          <Skeleton className="h-[22px] w-[140px]" />
          <Skeleton className="mt-20 h-[240px] w-full" />
        </div>
        <div className="rounded-md border border-hairline p-20">
          <Skeleton className="h-[22px] w-[140px]" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="mt-16 h-[36px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
