/**
 * What the oldest browser Bliss supports cannot run. docs/16 section 1, and docs/11 D-24.
 *
 * The Floor's reference device is an iPad mini 4, whose last system is iPadOS 15.8, so Safari 15.6.
 * Next 16 and Tailwind v4 target Safari 16.4, so their output can carry syntax and CSS that device
 * cannot read. These checks name each thing, so the build step can downlevel it and CI can fail on it.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// espree is ESLint's own parser: already installed, and reached through ESLint so no new dependency.
const espree = createRequire(require.resolve('eslint'))('espree');

/** The browsers every chunk must run in. Kept beside the browserslist in package.json. */
export const TARGETS = { chrome: '111', edge: '111', firefox: '111', safari: '15.4', ios: '15.4' };

/** Runtime methods newer than Safari 15.4. A bundle that calls one needs a polyfill first. */
const NEWER_APIS = ['.toSorted(', '.toReversed(', '.toSpliced(', 'Object.groupBy(', 'Map.groupBy(', 'Promise.withResolvers(', 'Array.fromAsync(', '.findLastIndex(Symbol'];

/** Syntax Safari 15.4 cannot parse, found by walking the tree. Empty when the chunk is safe. */
export function jsProblems(source) {
  let ast;
  try {
    ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowReserved: true });
  } catch {
    try {
      ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (error) {
      return [`does not parse: ${String(error.message).slice(0, 80)}`];
    }
  }
  const found = new Set();
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'StaticBlock') found.add('class static block (Safari 16.4)');
    if (node.type === 'Literal' && node.regex) {
      if (/\(\?<[=!]/.test(node.regex.pattern)) found.add('regex lookbehind (Safari 16.4)');
      if (node.regex.flags.includes('v')) found.add('regex v flag (Safari 17)');
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && typeof value.type === 'string') visit(value);
    }
  };
  visit(ast);
  for (const api of NEWER_APIS) if (source.includes(api)) found.add(`${api.replace(/[.(]/g, '')} (newer than Safari 15.4)`);
  return [...found];
}

/** Colour and layout features Safari 15.4 lacks, outside an @supports guard. Empty when the CSS is safe. */
export function cssProblems(css) {
  const unguarded = stripSupports(css);
  const found = [];
  for (const [feature, label] of [
    [/color-mix\(/, 'color-mix() (Safari 16.2)'],
    [/:has\(/, ':has() (Safari 15.4 partial, avoided)'],
    // The at-rule only: `.\@container{container-type:...}` is a harmless class of the same name.
    [/(?<!\\)@container[\s(]/, 'container queries (Safari 16)'],
    [/@starting-style/, '@starting-style (Safari 17.5)'],
    [/field-sizing/, 'field-sizing (not in Safari)'],
    [/light-dark\(/, 'light-dark() (Safari 17.5)'],
  ]) {
    if (feature.test(unguarded)) found.push(label);
  }
  // Every backdrop-filter needs the prefixed twin Safari 15 reads.
  const plain = (css.match(/(?<![-\w])backdrop-filter:/g) ?? []).length;
  const prefixed = (css.match(/-webkit-backdrop-filter:/g) ?? []).length;
  if (plain > prefixed) found.push(`backdrop-filter without -webkit- (${plain - prefixed})`);
  return found;
}

/** The CSS with every @supports block removed, so only what a browser meets unconditionally is left. */
function stripSupports(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@supports', i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    let j = css.indexOf('{', at);
    let depth = 1;
    j += 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    i = j;
  }
  return out;
}
