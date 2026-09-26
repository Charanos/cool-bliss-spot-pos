import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

/**
 * The way on from a row or a card: a quiet pill that turns solid ink when its row is hovered, with
 * an arrow that nudges toward where it leads. Put it inside an element with `group`. A link, so it
 * opens in a new tab and reads as one. docs/19 section 3.
 */
export function ActionPill({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        'relative z-raised inline-flex h-row-compact shrink-0 items-center gap-6 rounded-pill border border-edge bg-card px-12 text-body-sm font-medium text-ink transition-hover',
        'group-hover:border-ink group-hover:bg-ink group-hover:text-page focus-visible:border-ink focus-visible:bg-ink focus-visible:text-page',
        className,
      )}
    >
      {children}
      <IconArrowRight size={14} stroke={1.75} aria-hidden="true" className="nudge-on-hover" />
    </Link>
  );
}
