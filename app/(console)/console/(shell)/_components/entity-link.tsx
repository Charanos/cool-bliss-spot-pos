import { cx } from '@bliss/ui/lib/cx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { type RecordKind, hrefFor } from '../_lib/nav';

/**
 * A record's name as a link to its page: a product, a supplier, a person, a bill. The one way the
 * Console names a record, so every name clicks through. Inside a linked row or card it sits above
 * the stretched link (z-raised) and stays its own target. Server safe.
 */
export function EntityLink({ kind, id, children, className, muted }: { kind: RecordKind; id: string | null | undefined; children: ReactNode; className?: string; muted?: boolean }) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link
      href={hrefFor(kind, id)}
      className={cx(
        'relative z-raised rounded-sm underline decoration-transparent underline-offset-4 transition-hover hover:decoration-current focus-visible:decoration-current',
        muted ? 'text-ink-muted hover:text-ink' : 'text-ink',
        className,
      )}
    >
      {children}
    </Link>
  );
}
