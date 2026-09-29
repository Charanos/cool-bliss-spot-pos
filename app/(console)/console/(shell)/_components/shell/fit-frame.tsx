'use client';

import { useEffect } from 'react';

/** The Console's narrowest desk, in CSS pixels (the frame-min token). */
const FRAME = 768;

/**
 * The desk lays itself out from an iPad held upright (768) upwards, in both orientations. Only a
 * screen narrower than that, a phone, is shown the whole desk scaled to fit, the
 * same as a laptop only smaller, rather than a page wider than the screen. A dialog is fixed to the
 * screen, so on a wider page it would be cut off at the edge, with nothing to scroll to. Wider
 * screens are left as they are. The sign-in, outside the desk, gets its own width back on the way out.
 */
export function FitFrame() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const before = meta.content;
    const fit = () => {
      // iOS reports the screen as it is held upright whatever the orientation, so the width across
      // is the longer side on its side and the shorter one upright.
      const { width, height } = window.screen;
      const across = window.matchMedia('(orientation: landscape)').matches ? Math.max(width, height) : Math.min(width, height);
      meta.content = across < FRAME ? `width=${FRAME}, viewport-fit=cover` : before;
    };
    fit();
    window.addEventListener('orientationchange', fit);
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('orientationchange', fit);
      window.removeEventListener('resize', fit);
      meta.content = before;
    };
  }, []);
  return null;
}
