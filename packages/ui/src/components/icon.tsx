import type { ComponentType } from 'react';

/** Tabler icons only. docs conventions. Every icon renders at 1.5 stroke for the one-pane weight. */
export type TablerIcon = ComponentType<{
  size?: number | string;
  stroke?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export const ICON_STROKE = 1.5;

export function Icon({ icon: Glyph, size = 20, className }: { icon: TablerIcon; size?: 16 | 20 | 24 | 28; className?: string }) {
  return <Glyph size={size} stroke={ICON_STROKE} className={className} aria-hidden="true" />;
}
