import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { fromVars, gsap, isInstant, isReduced, play, splitBudget, staggered, vars } from './engine';

/**
 * Console animations, ceiling 400ms. ScrollTrigger lives here and only here: the Floor bundle
 * budget test fails the build if it appears in a Floor chunk.
 */
gsap.registerPlugin(ScrollTrigger);

export { ScrollTrigger };

export function pageEnter(el: Element) {
  return play('page.enter', () => gsap.fromTo(el, fromVars({ y: 12, opacity: 0 }), vars('page.enter', { y: 0, opacity: 1 })), {
    targets: el,
  });
}

/**
 * Reveal once as a section enters at 85% of the viewport. once: true, so a report scrolled up and
 * down never re-animates. Called from the section's own effect, which React runs only after that
 * section has hydrated: a layout effect querying the DOM would style streamed HTML React does not
 * own yet, and hydration would then disagree with the server about the style attribute.
 * Sections already on screen arrive with page.enter and are left alone.
 */
export function sectionReveal(el: Element) {
  if (isReduced() || isInstant()) return null;
  if (el.getBoundingClientRect().top <= window.innerHeight * 0.85) return null;
  // Side by side sections cross the line together; the sibling index staggers them 40ms apart.
  const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
  return gsap.fromTo(
    el,
    { y: 20, opacity: 0 },
    {
      ...vars('section.reveal', { y: 0, opacity: 1 }),
      delay: Math.min(Math.max(index, 0), 2) * 0.04,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    },
  );
}

/** Bars grow from the baseline, staggered 25ms, total 400ms. First view only. */
export function chartDraw(bars: Element[]) {
  if (bars.length === 0) return null;
  const { each, stagger } = splitBudget(0.4, bars.length, 0.025, 0.2);
  return play(
    'chart.draw',
    () =>
      gsap.fromTo(
        bars,
        fromVars({ scaleY: 0, transformOrigin: '50% 100%' }),
        staggered(vars('chart.draw', { scaleY: 1, transformOrigin: '50% 100%' }), each, stagger),
      ),
    { targets: bars },
  );
}

/** New rows fade in, staggered 12ms, capped at 20 rows so a 500 row result never takes six seconds. */
export function tableRowsEnter(rows: Element[]) {
  const capped = rows.slice(0, 20);
  if (capped.length === 0) return null;
  const { each, stagger } = splitBudget(0.24, capped.length, 0.012, 0.08);
  return play(
    'table.row.enter',
    () => gsap.fromTo(capped, { opacity: 0 }, staggered(vars('table.row.enter', { opacity: 1 }), each, stagger)),
    { targets: capped },
  );
}

export function consoleSheetEnter(sheet: Element, scrim: Element | null) {
  return play(
    'console.sheet.enter',
    () => {
      const tl = gsap.timeline();
      tl.fromTo(sheet, fromVars({ y: 32, opacity: 0 }), vars('console.sheet.enter', { y: 0, opacity: 1 }), 0);
      if (scrim) tl.fromTo(scrim, { opacity: 0 }, { ...vars('console.sheet.enter', { opacity: 1 }), duration: 0.2 }, 0);
      return tl;
    },
    { targets: sheet },
  );
}

export function consoleSheetExit(sheet: Element, scrim: Element | null, onDone: () => void) {
  return play(
    'console.sheet.exit',
    () => {
      const tl = gsap.timeline();
      tl.to(sheet, vars('console.sheet.exit', { y: 16, opacity: 0 }), 0);
      if (scrim) tl.to(scrim, vars('console.sheet.exit', { opacity: 0 }), 0);
      return tl;
    },
    { targets: sheet, onDone },
  );
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/** After async content changes document height, debounced 100ms. */
export function refreshScrollTriggers() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);
}
