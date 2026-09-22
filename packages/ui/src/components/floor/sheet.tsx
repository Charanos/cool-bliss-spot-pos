'use client';

import type { ReactNode } from 'react';
import { sheetEnter, sheetExit } from '../../motion/floor';
import { Overlay, type OverlayMotion, type OverlayProps } from '../overlay';

const floorMotion: OverlayMotion = {
  enter: (panel, scrim) => {
    sheetEnter(panel, scrim);
  },
  exit: (panel, scrim, done) => {
    sheetExit(panel, scrim, done);
  },
};

/**
 * The Floor's working overlay: a sheet at the bottom edge of a phone, where the thumb is, and a
 * centred dialog from a tablet up, where the hand is already in the middle of the screen.
 * sheet.enter is 140ms.
 */
export function Sheet(props: Omit<OverlayProps, 'motion' | 'placement' | 'bottomOffset'> & { children: ReactNode; keepBase?: boolean }) {
  const { width = 'md', keepBase: _keepBase, ...rest } = props;
  return <Overlay {...rest} width={width} placement="adaptive" motion={floorMotion} />;
}

/**
 * A dialog that asks for a decision: a reason, a PIN, a confirmation. Centred on every screen,
 * because it is short and it is a question, not a working surface.
 */
export function FloorDialog(props: Omit<OverlayProps, 'motion' | 'placement' | 'bottomOffset'>) {
  return <Overlay {...props} placement="dialog" motion={floorMotion} />;
}
