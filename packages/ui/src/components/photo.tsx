'use client';

import { type ImgHTMLAttributes, type ReactNode, useEffect, useState } from 'react';

/**
 * A photograph that never shows as broken. Offline, blocked, moved or deleted, it gives way to its
 * fallback (initials, a category glyph, nothing), so a tablet without signal still reads cleanly.
 * Lazy and async by default; sized by its container.
 */
export function Photo({ src, alt = '', fallback = null, ...rest }: { src: string | null | undefined; alt?: string; fallback?: ReactNode } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- photographs from the asset store, cached by the service worker for offline use
    <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} {...rest} />
  );
}
