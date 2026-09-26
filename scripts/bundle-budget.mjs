/**
 * The Floor and Counter bundle budget. ADR 003 and docs/07 section 8.
 *
 * Reads the prerendered station pages from the last `next build`, collects the scripts each one loads
 * on first paint (the noModule polyfills are skipped: no tablet we support runs them), and gzips them.
 *
 * The budget is for the station's entry bundle: what the page loads beyond the framework baseline
 * every route shares (React, the Next runtime, the webpack loader). That baseline is read from the
 * not-found page, so it follows the framework version rather than a hard-coded list, and it is
 * reported alongside so the whole first load stays visible.
 *
 * It also fails outright when:
 *  - Lenis or the ScrollTrigger plugin is in a station bundle (docs/07: the Floor never scrolls smoothly)
 *  - a Console chunk is loaded by a station page (ADR 003: the Floor carries no Console code)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NEXT = join(ROOT, '.next');
const APP = join(NEXT, 'server/app');
const BUDGET_KB = 220;
const SURFACES = ['floor', 'counter'];
/** Strings only the packages themselves carry. A bare "ScrollTrigger" is also in GSAP core, which looks it up lazily. */
const FORBIDDEN = { Lenis: 'lenis-smooth', ScrollTrigger: 'scroller-start' };

if (!existsSync(APP)) {
  console.error('bundle-budget: no build found. Run pnpm build first.');
  process.exit(1);
}

const sizes = new Map();
const gz = (src) => {
  if (!sizes.has(src)) {
    const body = readFileSync(join(NEXT, src.replace(/^\/_next\//, '')));
    sizes.set(src, { kb: gzipSync(body).length / 1024, text: body.toString('utf8') });
  }
  return sizes.get(src);
};

function scriptsIn(page) {
  const html = readFileSync(join(APP, page), 'utf8');
  const srcs = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((m) => m[1])
    .filter((attrs) => !/\bnoModule\b/i.test(attrs))
    .map((attrs) => /\bsrc="([^"]+)"/.exec(attrs)?.[1])
    .filter(Boolean);
  return [...new Set(srcs)];
}

function pagesOf(surface) {
  const dir = join(APP, surface);
  const nested = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => `${surface}/${f}`) : [];
  return [`${surface}.html`, ...nested].filter((p) => existsSync(join(APP, p)));
}

const baseline = new Set(scriptsIn('_not-found.html'));
const baselineKb = [...baseline].reduce((n, s) => n + gz(s).kb, 0);
const failures = [];
const rows = [];

for (const surface of SURFACES) {
  const pages = pagesOf(surface);
  if (pages.length === 0) failures.push(`${surface}: no prerendered pages found`);
  for (const page of pages) {
    const scripts = scriptsIn(page);
    const own = scripts.filter((s) => !baseline.has(s));
    const entryKb = own.reduce((n, s) => n + gz(s).kb, 0);
    const totalKb = scripts.reduce((n, s) => n + gz(s).kb, 0);
    rows.push({ page, entryKb, totalKb });
    if (entryKb > BUDGET_KB) failures.push(`${page}: entry bundle ${entryKb.toFixed(1)}KB gzipped, above the ${BUDGET_KB}KB budget`);
    for (const s of own) {
      if (s.includes('/(console)/')) failures.push(`${page}: loads Console code (${s})`);
      for (const [name, marker] of Object.entries(FORBIDDEN)) if (gz(s).text.includes(marker)) failures.push(`${page}: ${name} is in the bundle (${s})`);
    }
  }
}

const pad = Math.max(...rows.map((r) => r.page.length));
console.log(`Framework baseline, shared by every route: ${baselineKb.toFixed(1)}KB gzipped`);
for (const r of rows) console.log(`${r.page.padEnd(pad)}  entry ${r.entryKb.toFixed(1).padStart(6)}KB  first load ${r.totalKb.toFixed(1).padStart(6)}KB`);

if (failures.length) {
  console.error(`\nbundle-budget: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nbundle-budget: every station page is inside ${BUDGET_KB}KB`);
