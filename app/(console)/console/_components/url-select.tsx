'use client';

import { SelectField } from '@bliss/ui/components/fields';
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
    <div className="w-[200px]" aria-busy={pending}>
      <SelectField
        label={label}
        pending={pending}
        value={params.get(param) ?? fallback}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
        options={allLabel === null ? options : [{ value: '', label: allLabel }, ...options]}
      />
    </div>
  );
}
