'use client';

import type { ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { cx } from '../../lib/cx';
import type { TablerIcon } from '../icon';
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

/**
 * The mark beside a station sheet's title: what the sheet is about, in a tile of its tone. The same
 * place and size as the Console dialog's icon, larger for a tablet at arm's length.
 */
export function SheetIcon({ icon: Glyph, tone = 'accent' }: { icon: TablerIcon; tone?: 'accent' | 'stop' | 'low' | 'poured' }) {
  return (
    <span
      className={cx(
        'flex size-control-lg items-center justify-center rounded-control',
        tone === 'stop' ? 'bg-stop-wash text-stop' : tone === 'low' ? 'bg-low-wash text-low' : tone === 'poured' ? 'bg-poured-wash text-poured' : 'bg-accent-wash text-accent-text',
      )}
    >
      <Glyph size={22} stroke={1.5} />
    </span>
  );
}

/* ----------------------------------------------------------- sheet vocabulary */

/**
 * The quiet way out of a station sheet: Cancel, Close or Keep it here, in words, never a button
 * that competes with the outcome beside it.
 */
export function SheetCancel({ children = 'Cancel', onClick }: { children?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-control-lg items-center rounded-pill px-16 text-body font-medium text-ink-muted press-feedback transition-hover hover:bg-control hover:text-ink">
      {children}
    </button>
  );
}

/** A part of a sheet: a heading in capitals running into a hairline, and a note on the right. */
export function SheetSection({ label, aside, children, className }: { label: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex flex-col gap-12', className)} aria-label={label}>
      <div className="flex items-center gap-12">
        <span className="label-caps shrink-0 text-ink-subtle">{label}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-rule-raised/50" />
        {aside ? <span className="shrink-0 text-label text-ink-subtle">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A sunken panel inside a sheet: what the sheet is about, or a group of rows. */
export function SheetPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-col rounded-card bg-sunken/60 px-16 py-4', className)}>{children}</div>;
}

/** A row in a panel: a title and a line under it on the left, a figure or a control on the right. */
export function SheetRow({ title, detail, children }: { title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-row-floor items-center justify-between gap-16 border-t border-rule-raised/30 py-8 first:border-t-0">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="truncate text-body font-medium text-ink">{title}</span>
        {detail ? <span className="truncate text-body-sm text-ink-muted">{detail}</span> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

/** A choice in a sheet, as a pill: a modifier, a reason. On, it carries a tick and the accent. */
export function ChoiceChip({ on, onClick, children, extra }: { on: boolean; onClick: () => void; children: ReactNode; extra?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-target-floor items-center gap-8 rounded-pill border px-16 text-body press-feedback transition-hover',
        on ? 'border-accent/50 bg-accent-wash font-medium text-accent-text' : 'border-rule-raised/40 bg-control/60 text-ink-muted hover:bg-control hover:text-ink',
      )}
    >
      {on ? <IconCheck size={16} stroke={2} aria-hidden="true" /> : null}
      <span>{children}</span>
      {extra ? <span className={cx('font-mono tabular text-num-sm', on ? 'text-accent-text' : 'text-ink-subtle')}>{extra}</span> : null}
    </button>
  );
}
