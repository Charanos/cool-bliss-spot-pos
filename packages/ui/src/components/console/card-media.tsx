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

  // Every layer shares one grid cell rather than being positioned, so nothing here becomes the box a
  // stretched link measures from: the title's link covers the whole card, photograph and rows alike.
  const cell = { gridArea: '1 / 1' } as const;
  return (
    <div className={cx('grid h-media shrink-0 overflow-hidden border-b border-edge', failed ? (tint ?? 'card-band-strong') : 'bg-band-strong', className)} style={{ gridTemplateRows: '100%', gridTemplateColumns: '100%' }}>
      {failed ? (
        <span aria-hidden="true" style={cell} className="flex select-none items-center justify-center font-mono text-num-xl text-ink-subtle media-zoom">
          {initial}
        </span>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded or catalogue image, sized by CSS */}
          <img ref={ref} src={src!} alt={alt} loading="lazy" onError={() => setFailed(true)} style={cell} className="size-full object-cover media-zoom" />
          <div aria-hidden="true" style={cell} className="media-scrim" />
        </>
      )}
      {meta ? (
        <div style={cell} className="z-raised m-12 self-start justify-self-end">
          {meta}
        </div>
      ) : null}
      {actions ? (
        <div style={cell} className="z-raised m-12 flex gap-6 self-start justify-self-start opacity-0 transition-hover group-hover:opacity-100 group-focus-within:opacity-100">
          {actions}
        </div>
      ) : null}
      <div style={cell} className="flex min-w-0 flex-col gap-2 self-end px-20 pb-16">
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
