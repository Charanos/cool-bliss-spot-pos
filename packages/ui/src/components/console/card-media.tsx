'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import type { HeadingLevel } from './card';

/**
 * A photograph across the top of a card, with the title set on it over a scrim: a product's
 * picture, a person's photo, a delivery's first page. The picture leans in slowly under the
 * pointer. If the image cannot load (offline, or the store has lost it) the band keeps its place
 * and shows the name's initial instead, with the title in ink, so a grid never breaks rhythm.
 */
export function CardMedia({
  src,
  alt = '',
  title,
  subtitle,
  href,
  meta,
  actions,
  tint,
  level = 'h3',
  className,
}: {
  src: string | null;
  alt?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  /** A chip set in the photograph's top corner: a state, a count. */
  meta?: ReactNode;
  /** Quick actions over the photograph's other corner, shown when the card is hovered or focused. */
  actions?: ReactNode;
  /** The tint the initials sit on when there is no photograph, such as the category's colour class. */
  tint?: string;
  level?: HeadingLevel;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  const Heading = level;
  const initial = typeof title === 'string' ? title.trim().charAt(0).toUpperCase() : '';

  // An image that failed before hydration never fires onError on the client; check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className={cx('relative h-media shrink-0 overflow-hidden border-b border-edge', failed ? (tint ?? 'card-band-strong') : 'bg-band-strong', className)}>
      {failed ? (
        <span aria-hidden="true" className="absolute inset-0 flex select-none items-center justify-center font-mono text-num-xl text-ink-subtle media-zoom">
          {initial}
        </span>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded or catalogue image, sized by CSS */}
          <img ref={ref} src={src!} alt={alt} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover media-zoom" />
          <div aria-hidden="true" className="absolute inset-0 media-scrim" />
        </>
      )}
      {meta ? <div className="absolute right-12 top-12 z-raised">{meta}</div> : null}
      {actions ? (
        <div className="absolute left-12 top-12 z-raised flex gap-6 opacity-0 transition-hover group-hover:opacity-100 group-focus-within:opacity-100">{actions}</div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-20 pb-16">
        <Heading className={cx('min-w-0 truncate text-title-section', failed ? 'text-ink' : 'text-on-scrim')}>
          {href ? (
            <Link href={href} className="link-stretched rounded-sm focus-visible:outline-offset-4">
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        {subtitle ? <p className={cx('truncate text-body-sm', failed ? 'text-ink-muted' : 'text-on-scrim')}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
