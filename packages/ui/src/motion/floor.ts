import { Flip } from 'gsap/Flip';
import { fromVars, gsap, play, splitBudget, staggered, vars } from './engine';

/**
 * Floor animations, ceiling 140ms. docs/07-motion-and-interaction.md section 6.
 * Flip is registered here and nowhere in a shared entry, so the Floor never loads ScrollTrigger
 * or Lenis, and the Console never pays for Flip.
 */
gsap.registerPlugin(Flip);

/** Finger down on a product tile. Fires before any state change. */
export function tilePressDown(el: Element) {
  return play('tile.press', () => gsap.to(el, vars('tile.press', { scale: 0.96 })), { targets: el });
}

export function tilePressUp(el: Element) {
  return play('tile.press', () => gsap.to(el, vars('tile.press', { scale: 1 })), { targets: el });
}

export function lineEnter(el: Element) {
  return play('line.enter', () => gsap.fromTo(el, fromVars({ y: 10, opacity: 0 }), vars('line.enter', { y: 0, opacity: 1 })), {
    targets: el,
  });
}

export function lineExit(el: Element, onDone: () => void) {
  return play('line.exit', () => gsap.to(el, vars('line.exit', { opacity: 0, x: 12 })), { targets: el, onDone });
}

/** The ring scales in; the chip itself never moves. */
export function seatSelect(ring: Element) {
  return play(
    'seat.select',
    () => gsap.fromTo(ring, fromVars({ scale: 0.8, opacity: 0 }), vars('seat.select', { scale: 1, opacity: 1 })),
    { targets: ring },
  );
}

/**
 * Fire: the unfired markers lift and fade, staggered 16ms, inside 120ms however many lines there
 * are. The rows stay, because fired lines remain on the rail as waiting and then poured.
 * See docs/11-design-drift.md, D-11.
 */
export function orderFire(markers: Element[], onDone: () => void) {
  if (markers.length === 0) {
    onDone();
    return null;
  }
  const { each, stagger } = splitBudget(0.12, markers.length, 0.016);
  return play('order.fire', () => gsap.to(markers, staggered(vars('order.fire', { y: -6, opacity: 0 }), each, stagger)), {
    targets: markers,
    onDone,
  });
}

/** An item running out should be noticed, not alarming. */
export function tileFinished(tile: Element, hairline: Element | null) {
  return play(
    'tile.finished',
    () => {
      const tl = gsap.timeline();
      tl.fromTo(tile, { opacity: 1 }, vars('tile.finished', { opacity: 0.4 }), 0);
      if (hairline) tl.fromTo(hairline, fromVars({ scaleX: 0 }), vars('tile.finished', { scaleX: 1 }), 0);
      return tl;
    },
    { targets: tile },
  );
}

/** The dot cross-fades. The chip never slides, grows or pulses. */
export function connChange(dot: Element) {
  return play('conn.change', () => gsap.fromTo(dot, { opacity: 0 }, vars('conn.change', { opacity: 1 })), { targets: dot });
}

export function sheetEnter(sheet: Element, scrim: Element | null) {
  return play(
    'sheet.enter',
    () => {
      const tl = gsap.timeline();
      tl.fromTo(sheet, fromVars({ y: 24, opacity: 0 }), vars('sheet.enter', { y: 0, opacity: 1 }), 0);
      if (scrim) tl.fromTo(scrim, { opacity: 0 }, vars('sheet.enter', { opacity: 1 }), 0);
      return tl;
    },
    { targets: sheet },
  );
}

export function sheetExit(sheet: Element, scrim: Element | null, onDone: () => void) {
  return play(
    'sheet.exit',
    () => {
      const tl = gsap.timeline();
      tl.to(sheet, vars('sheet.exit', { y: 16, opacity: 0 }), 0);
      if (scrim) tl.to(scrim, vars('sheet.exit', { opacity: 0 }), 0);
      return tl;
    },
    { targets: sheet, onDone },
  );
}

/**
 * line.moveSeat: the row travels from its old seat group to its new one. Capture before the state
 * changes, play once the DOM has the row in its new group. This is the animation that makes the
 * seat model legible, so it is never replaced with a fade.
 */
export function captureRows(container: Element, selector = '[data-flip-id]') {
  return Flip.getState(container.querySelectorAll(selector));
}

export function playRowMove(state: Flip.FlipState, container: Element, selector = '[data-flip-id]') {
  const targets = Array.from(container.querySelectorAll(selector));
  const { duration, ease } = vars('line.moveSeat');
  return play(
    'line.moveSeat',
    () =>
      Flip.from(state, {
        duration: typeof duration === 'number' ? duration : 0,
        ease: ease as gsap.EaseFunction,
        targets,
        absolute: false,
        nested: false,
        prune: true,
      }),
    { targets },
  );
}

export type FlipState = Flip.FlipState;

/** Items rendered on a list's first paint. More than this and the rest simply appear. */
const LIST_ENTER_CAP = 8;

/**
 * list.enter: the first paint of a Floor list, such as tab cards when the tab list opens. The whole
 * group lands inside 140ms however many there are, capped at eight so a busy night is not a wave.
 * Orient only: never on a live update, never on a row scrolled into view.
 */
export function listEnter(items: Element[]) {
  const targets = items.slice(0, LIST_ENTER_CAP);
  if (targets.length === 0) return null;
  const { each, stagger } = splitBudget(0.14, targets.length, 0.016, 0.06);
  return play('list.enter', () => gsap.fromTo(targets, fromVars({ y: 8, opacity: 0 }), staggered(vars('list.enter', { y: 0, opacity: 1 }), each, stagger)), {
    targets,
  });
}

