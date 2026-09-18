import type { motion } from '../tokens/tokens';

export type Surface = 'floor' | 'counter' | 'bar' | 'console';
export type EaseName = keyof typeof motion.ease;

export interface AnimationSpec {
  surface: Surface;
  /** Total duration in milliseconds, including stagger. Budgeted by bliss/motion-budget. */
  ms: number;
  ease: EaseName;
  /** A new animation in an occupied lane completes the previous one rather than queueing. */
  lane: string;
  /** What the animation is for: confirm, connect or orient. */
  job: 'confirm' | 'connect' | 'orient';
}

/**
 * Every animation in the product, docs/07-motion-and-interaction.md section 6. Anything not on
 * this list does not exist. Adding one means adding a row here and in the document.
 *
 * Rows marked "addition" are proposed in docs/11-design-drift.md: the registry specifies how
 * sheets enter but not how they leave.
 */
export const registry = {
  // Floor, ceiling 140ms
  'tile.press': { surface: 'floor', ms: 80, ease: 'snap', lane: 'press', job: 'confirm' },
  'line.enter': { surface: 'floor', ms: 120, ease: 'out', lane: 'rail', job: 'confirm' },
  'line.exit': { surface: 'floor', ms: 100, ease: 'in', lane: 'rail', job: 'orient' },
  'seat.select': { surface: 'floor', ms: 100, ease: 'snap', lane: 'seat', job: 'confirm' },
  'seat.total': { surface: 'floor', ms: 140, ease: 'out', lane: 'total', job: 'confirm' },
  'line.moveSeat': { surface: 'floor', ms: 140, ease: 'inOut', lane: 'rail', job: 'connect' },
  'order.fire': { surface: 'floor', ms: 120, ease: 'in', lane: 'rail', job: 'confirm' },
  'order.fire.count': { surface: 'floor', ms: 140, ease: 'out', lane: 'total', job: 'confirm' },
  'tile.finished': { surface: 'floor', ms: 120, ease: 'out', lane: 'grid', job: 'orient' },
  'conn.change': { surface: 'floor', ms: 120, ease: 'out', lane: 'conn', job: 'orient' },
  'sheet.enter': { surface: 'floor', ms: 140, ease: 'out', lane: 'sheet', job: 'orient' },
  'sheet.exit': { surface: 'floor', ms: 100, ease: 'in', lane: 'sheet', job: 'orient' }, // addition
  // Addition, docs/13-floor-tabs-revamp.md. Filters stay instant, like category switching.
  'list.enter': { surface: 'floor', ms: 140, ease: 'out', lane: 'list', job: 'orient' }, // addition

  // Counter, ceiling 240ms
  'amount.change': { surface: 'counter', ms: 200, ease: 'out', lane: 'amount', job: 'confirm' },
  'scope.switch': { surface: 'counter', ms: 220, ease: 'inOut', lane: 'bill', job: 'connect' },
  'tender.add': { surface: 'counter', ms: 200, ease: 'out', lane: 'tender', job: 'confirm' },
  'change.reveal': { surface: 'counter', ms: 200, ease: 'snap', lane: 'change', job: 'confirm' },
  'bill.settled': { surface: 'counter', ms: 240, ease: 'inOut', lane: 'bill', job: 'orient' },
  'keypad.press': { surface: 'counter', ms: 70, ease: 'snap', lane: 'press', job: 'confirm' },
  'drawer.variance': { surface: 'counter', ms: 240, ease: 'out', lane: 'amount', job: 'confirm' },

  // Bar view, ceiling 160ms
  'ticket.enter': { surface: 'bar', ms: 160, ease: 'out', lane: 'tickets', job: 'orient' },
  'line.poured': { surface: 'bar', ms: 140, ease: 'out', lane: 'line', job: 'confirm' },
  'ticket.clear': { surface: 'bar', ms: 160, ease: 'in', lane: 'tickets', job: 'orient' },

  // Console, ceiling 400ms
  'page.enter': { surface: 'console', ms: 240, ease: 'out', lane: 'page', job: 'orient' },
  'section.reveal': { surface: 'console', ms: 320, ease: 'out', lane: 'reveal', job: 'orient' },
  'metric.count': { surface: 'console', ms: 400, ease: 'out', lane: 'metric', job: 'orient' },
  'chart.draw': { surface: 'console', ms: 400, ease: 'out', lane: 'chart', job: 'orient' },
  'table.row.enter': { surface: 'console', ms: 240, ease: 'out', lane: 'rows', job: 'orient' },
  'console.sheet.enter': { surface: 'console', ms: 280, ease: 'out', lane: 'sheet', job: 'orient' },
  'console.sheet.exit': { surface: 'console', ms: 200, ease: 'in', lane: 'sheet', job: 'orient' }, // addition
} as const satisfies Record<string, AnimationSpec>;

export type AnimationName = keyof typeof registry;

/**
 * Two specs in the document state a duration above the Floor ceiling: seat.total at 180ms and the
 * order.fire count-down at 160ms. Both are clamped to 140ms here, because the ceiling is the harder
 * rule. See docs/11-design-drift.md, D-12.
 */
export const CEILING_MS: Record<Surface, number> = { floor: 140, bar: 160, counter: 240, console: 400 };

/** No more than three animations run at once on the Floor. */
export const MAX_CONCURRENT: Record<Surface, number> = { floor: 3, bar: 4, counter: 4, console: 12 };
