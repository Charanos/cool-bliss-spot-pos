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

/** The Floor's base layer height, which every sheet stops above. */
export const FLOOR_BASE_HEIGHT = 72;

/**
 * A centered dialog on the Floor — tablet-first, so sheets no longer anchor to the bottom edge.
 * sheet.enter is 140ms.
 */
export function Sheet(props: Omit<OverlayProps, 'motion' | 'placement' | 'bottomOffset'> & { children: ReactNode; keepBase?: boolean }) {
  const { width = 'md', ...rest } = props;
  return <Overlay {...rest} width={width} placement="dialog" motion={floorMotion} />;
}

/** A centred dialog on the Floor, for the reason dialog and anything needing a PIN. */
export function FloorDialog(props: Omit<OverlayProps, 'motion' | 'placement' | 'bottomOffset'>) {
  return <Overlay {...props} placement="dialog" motion={floorMotion} bottomOffset={FLOOR_BASE_HEIGHT} />;
}
