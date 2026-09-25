'use client';

import { FilterDropdown } from '@bliss/ui/components/console/data-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * A filter the server reads, such as a location or a date range. It navigates, so the server
 * component re-queries; client-side table filters use the table's own URL state instead.
 */
export function UrlSelect({
  param,
  label,
  options,
  allLabel = 'All',
  fallback = '',
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string | null;
  /** What the server uses when the parameter is absent, so the control shows the truth. */
  fallback?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <div aria-busy={pending} className="opacity-100 transition-opacity aria-busy:opacity-50">
      <FilterDropdown
        label={label}
        value={params.get(param) ?? fallback}
        onChange={(val) => {
          const next = new URLSearchParams(params.toString());
          if (val && val !== fallback) next.set(param, val);
          else next.delete(param);
          start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
        options={options}
        allLabel={allLabel}
      />
    </div>
  );
}
