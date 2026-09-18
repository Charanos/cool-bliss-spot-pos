'use client';

import { consoleSheetEnter, consoleSheetExit } from '../../motion/console';
import { useLenis } from '../../motion/lenis-provider';
import { Overlay, type OverlayMotion, type OverlayProps } from '../overlay';

const consoleMotion: OverlayMotion = {
  enter: (panel, scrim) => {
    consoleSheetEnter(panel, scrim);
  },
  exit: (panel, scrim, done) => {
    consoleSheetExit(panel, scrim, done);
  },
};

/**
 * A Console dialog or side sheet. Scroll is stopped with lenis.stop() rather than overflow hidden on
 * the body, which would jump the scroll position. docs/07 section 5.
 */
export function ConsoleOverlay({ placement = 'dialog', ...props }: Omit<OverlayProps, 'motion' | 'placement'> & { placement?: 'dialog' | 'side' }) {
  const lenis = useLenis();
  return (
    <Overlay
      {...props}
      placement={placement}
      motion={consoleMotion}
      onOpened={() => {
        lenis?.stop();
        props.onOpened?.();
      }}
      onClosed={() => {
        lenis?.start();
        props.onClosed?.();
      }}
    />
  );
}
