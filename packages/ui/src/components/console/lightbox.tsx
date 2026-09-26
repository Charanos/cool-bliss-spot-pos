'use client';

import { ConsoleOverlay } from './dialog';

/**
 * A photo or a scan at full size, in the Console dialog: labelled, Escape closes it, focus is held
 * inside and returns to what opened it. A PDF opens in its own tab instead.
 */
export function ImageLightbox({ src, alt, title, onClose }: { src: string | null; alt: string; title: string; onClose: () => void }) {
  return (
    <ConsoleOverlay open={Boolean(src)} onClose={onClose} title={title} width="full">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- an upload served by the Console, not a static asset
        <img src={src} alt={alt} className="mx-auto max-h-lightbox w-auto rounded-md object-contain" />
      ) : null}
    </ConsoleOverlay>
  );
}
