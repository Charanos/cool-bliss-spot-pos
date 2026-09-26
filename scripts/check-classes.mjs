/**
 * Dead class checker. docs/06-design-system.md section 9.
 *
 * Bliss resets every Tailwind namespace in tokens.css, so a utility that names a token we do not
 * have compiles to nothing at all: `p-18` between our 16 and 20 is not a rounding error, it is a
 * card with no padding, and nothing fails. This walks the class lists and says so.
 *
 * It only judges the namespaces we reset, and inside those only the words that must name a token,
 * so a static utility such as `rounded-full` or `w-full` is never questioned.
 *
 * Run through `pnpm lint`, or on its own with `node scripts/check-classes.mjs [--json]`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN = ['app', 'packages/ui/src', 'lib'];
const TOKENS = join(ROOT, 'packages/ui/src/styles/tokens.css');
const UTILITY_SOURCES = ['packages/ui/src/styles/base.css', 'packages/ui/src/styles/index.css', 'app/globals.css'];

/* ------------------------------------------------------------------ tokens */

const tokenCss = readFileSync(TOKENS, 'utf8');
/** Every `--namespace-name:` in the theme, grouped by namespace. */
const tokens = new Map();
for (const [, name] of tokenCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
  for (const ns of ['color', 'font-weight', 'font', 'text-shadow', 'inset-shadow', 'drop-shadow', 'text', 'tracking', 'leading', 'radius', 'shadow', 'blur', 'ease', 'animate', 'breakpoint', 'perspective', 'aspect', 'spacing']) {
    if (name.startsWith(`--${ns}-`)) {
      if (!tokens.has(ns)) tokens.set(ns, new Set());
      tokens.get(ns).add(name.slice(ns.length + 3));
      break;
    }
  }
}
const has = (ns, name) => tokens.get(ns)?.has(name) ?? false;

const customUtilities = new Set();
const customVariants = new Set();
for (const file of UTILITY_SOURCES) {
  try {
    const css = readFileSync(join(ROOT, file), 'utf8');
    for (const [, name] of css.matchAll(/@utility\s+([a-z0-9-]+)/g)) customUtilities.add(name);
    for (const [, name] of css.matchAll(/@custom-variant\s+([a-z0-9-]+)/g)) customVariants.add(name);
  } catch {
    /* an optional source */
  }
}

const spacingValues = [...(tokens.get('spacing') ?? [])].filter((s) => /^\d+$/.test(s)).map(Number).sort((a, b) => a - b);

/* -------------------------------------------------------------- the rules */

/** Words a utility may carry without naming a token, because Tailwind defines them itself. */
const STATIC = {
  spacing: new Set(['px', 'full', 'auto', 'none', 'screen', 'dvh', 'dvw', 'svh', 'lvh', 'min', 'max', 'fit', 'prose', 'reverse', 'inherit', 'initial', 'revert', 'unset']),
  colour: new Set(['transparent', 'current', 'inherit', 'auto', 'none', 'initial']),
  text: new Set(['left', 'center', 'right', 'justify', 'start', 'end', 'wrap', 'nowrap', 'balance', 'pretty', 'clip', 'ellipsis', 'inherit', 'initial']),
  radius: new Set(['none', 'full']),
  shadow: new Set(['none', 'initial']),
  blur: new Set(['none']),
  ease: new Set(['linear', 'initial']),
  leading: new Set(['none']),
  animate: new Set(['none']),
  aspect: new Set(['auto', 'square']),
  font: new Set(['sans', 'mono', 'serif']),
};

/** Utilities whose value comes from the spacing scale. */
const SPACING_PREFIXES = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'size', 'min-w', 'min-h', 'max-w', 'max-h',
  'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end',
  'translate', 'translate-x', 'translate-y', 'basis', 'indent',
  'scroll-p', 'scroll-px', 'scroll-py', 'scroll-pt', 'scroll-pr', 'scroll-pb', 'scroll-pl',
  'scroll-m', 'scroll-mx', 'scroll-my', 'scroll-mt', 'scroll-mr', 'scroll-mb', 'scroll-ml',
];

/** Utilities whose value must be a colour token. */
const COLOUR_PREFIXES = ['bg', 'text', 'border', 'border-x', 'border-y', 'border-t', 'border-r', 'border-b', 'border-l', 'ring', 'ring-offset', 'outline', 'divide', 'fill', 'stroke', 'from', 'via', 'to', 'accent', 'caret', 'decoration', 'placeholder', 'shadow'];

/** Namespaces reset wholesale: any named value must be one of ours. */
const NAMESPACED = [
  { prefix: 'rounded', ns: 'radius', statics: STATIC.radius, fix: 'rounded-sm, rounded-md, rounded-lg or rounded-dot' },
  { prefix: 'blur', ns: 'blur', statics: STATIC.blur, fix: 'blur-glass or blur-veil' },
  { prefix: 'backdrop-blur', ns: 'blur', statics: STATIC.blur, fix: 'backdrop-blur-glass or backdrop-blur-veil' },
  { prefix: 'ease', ns: 'ease', statics: STATIC.ease, fix: 'ease-out, ease-in, ease-in-out or ease-snap' },
  { prefix: 'animate', ns: 'animate', statics: STATIC.animate, fix: 'animate-breathe' },
  { prefix: 'tracking', ns: 'tracking', statics: new Set(), fix: 'the letter spacing that comes with the type token' },
  { prefix: 'leading', ns: 'leading', statics: STATIC.leading, fix: 'the line height that comes with the type token' },
  { prefix: 'drop-shadow', ns: 'drop-shadow', statics: STATIC.shadow, fix: 'shadow-lift or shadow-key' },
  { prefix: 'inset-shadow', ns: 'inset-shadow', statics: STATIC.shadow, fix: 'a border or surface token' },
  { prefix: 'text-shadow', ns: 'text-shadow', statics: STATIC.shadow, fix: 'no text shadow' },
  { prefix: 'perspective', ns: 'perspective', statics: new Set(['none']), fix: 'an arbitrary value' },
  { prefix: 'aspect', ns: 'aspect', statics: STATIC.aspect, fix: 'aspect-[16/9]' },
];

const VARIANTS = new Set([
  'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'visited', 'target', 'disabled', 'enabled', 'checked', 'indeterminate', 'default', 'required', 'valid', 'invalid', 'placeholder-shown', 'autofill', 'read-only', 'empty', 'open', 'popover-open',
  'first', 'last', 'only', 'odd', 'even', 'first-of-type', 'last-of-type', 'only-of-type',
  'before', 'after', 'placeholder', 'file', 'marker', 'selection', 'first-line', 'first-letter', 'backdrop', 'details-content',
  'dark', 'light', 'motion-safe', 'motion-reduce', 'contrast-more', 'contrast-less', 'forced-colors', 'inverted-colors', 'pointer-fine', 'pointer-coarse', 'any-pointer-fine', 'any-pointer-coarse', 'portrait', 'landscape', 'print', 'rtl', 'ltr',
  'group-hover', 'group-focus', 'group-active', 'group-disabled', 'group-open', 'peer-hover', 'peer-focus', 'peer-checked', 'peer-disabled', 'peer-placeholder-shown', 'peer-focus-visible',
  'not-first', 'not-last', 'starting', 'supports-backdrop-filter',
]);

/** Corner and side suffixes that take the same token, such as rounded-t-md and border-b-rule. */
const SIDES = ['t', 'r', 'b', 'l', 's', 'e', 'x', 'y', 'tl', 'tr', 'br', 'bl', 'ss', 'se', 'ee', 'es'];

const isArbitrary = (value) => value.startsWith('[') || value.startsWith('(');
const isFraction = (value) => /^\d+\/\d+$/.test(value);
const isNumeric = (value) => /^-?\d+(\.\d+)?$/.test(value);

function nearestSpacing(n) {
  return spacingValues.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), spacingValues[0]);
}

/** One utility, already stripped of variants and the leading `-`. Returns a complaint or null. */
function judge(utility) {
  // Important, either way round: `p-16!` or the older `!p-16`. Both still name a token.
  const noBang = utility.startsWith('!') ? utility.slice(1) : utility;
  const bang = noBang.endsWith('!') ? noBang.slice(0, -1) : noBang;
  // A fraction is a value of its own (w-1/2); anything else after a slash is an opacity modifier.
  const base = isFraction(bang.slice(bang.lastIndexOf('-') + 1)) ? bang : bang.split('/')[0];
  if (base.includes('[') && !base.startsWith('[')) {
    // An arbitrary value on a known prefix, such as w-[48px]: the value is literal, nothing to check.
    const prefix = base.slice(0, base.indexOf('-['));
    if (prefix) return null;
  }
  if (customUtilities.has(base) || isArbitrary(base)) return null;

  for (const { prefix, ns, statics, fix } of NAMESPACED) {
    if (!base.startsWith(`${prefix}-`)) continue;
    let value = base.slice(prefix.length + 1);
    // rounded-t-md and friends carry a side before the token.
    if (prefix === 'rounded') {
      const [side, ...rest] = value.split('-');
      if (rest.length > 0 && SIDES.includes(side)) value = rest.join('-');
    }
    if (isArbitrary(value) || statics.has(value) || has(ns, value)) return null;
    return { kind: ns, message: `${base} is not in the theme, use ${fix}` };
  }

  if (base.startsWith('font-')) {
    const value = base.slice(5);
    if (isArbitrary(value) || STATIC.font.has(value) || has('font', value)) return null;
    if (has('font-weight', value)) return null;
    return { kind: 'font-weight', message: `${base} is not in the theme, use font-regular or font-medium` };
  }

  for (const prefix of SPACING_PREFIXES) {
    if (!base.startsWith(`${prefix}-`)) continue;
    const value = base.slice(prefix.length + 1);
    if (isArbitrary(value) || isFraction(value) || STATIC.spacing.has(value)) return null;
    if (has('spacing', value)) return null;
    // Only a number can be meant as spacing; a word here belongs to another utility, such as max-w-prose.
    if (!isNumeric(value)) continue;
    const n = Math.abs(Number(value));
    return { kind: 'spacing', message: `${base} is not in the spacing scale, nearest is ${prefix}-${nearestSpacing(n)}` };
  }

  // Type scale: text-<size> where the word is neither a colour nor an alignment.
  if (base.startsWith('text-')) {
    const value = base.slice(5);
    if (isArbitrary(value) || STATIC.text.has(value) || STATIC.colour.has(value) || has('text', value) || has('color', value)) return null;
    return { kind: 'text', message: `${base} is neither a type token nor a colour token` };
  }

  for (const prefix of [...COLOUR_PREFIXES].sort((a, b) => b.length - a.length)) {
    if (!base.startsWith(`${prefix}-`)) continue;
    let value = base.slice(prefix.length + 1);
    if (prefix === 'border' || prefix === 'divide' || prefix === 'ring' || prefix === 'outline') {
      const [side, ...rest] = value.split('-');
      if (rest.length > 0 && SIDES.includes(side)) value = rest.join('-');
    }
    if (isArbitrary(value) || STATIC.colour.has(value) || has('color', value)) return null;
    // A gradient direction rides on the bg prefix and names no colour.
    if (prefix === 'bg' && /^(gradient|linear|radial|conic)(-|$)/.test(value)) return null;
    // border-2, ring-1, divide-y and the rest are widths and styles, not colours.
    if (isNumeric(value) || ['solid', 'dashed', 'dotted', 'double', 'hidden', 'x', 'y', 't', 'r', 'b', 'l', 'reverse', 'underline', 'overline', 'line-through', 'no-underline', 'wavy', 'from-font', 'dynamic', 'inset', 'collapse', 'separate', 'spacing'].includes(value)) return null;
    if (value.startsWith('offset-') && isNumeric(value.slice(7))) return null;
    if (prefix === 'shadow' && (has('shadow', value) || STATIC.shadow.has(value))) return null;
    if (prefix === 'shadow') return { kind: 'shadow', message: `${base} is not in the theme, use shadow-raised, shadow-lift or shadow-key` };
    if (['bg', 'text', 'border', 'ring', 'outline', 'fill', 'stroke', 'from', 'via', 'to', 'divide', 'decoration', 'caret', 'accent', 'placeholder'].includes(prefix)) {
      return { kind: 'colour', message: `${base} is not a colour token` };
    }
  }
  return null;
}

/** Variants in front of a utility, such as `hover:tablet:`. */
function judgeVariants(parts) {
  for (const variant of parts) {
    const name = variant.replace(/^(group-|peer-|not-|max-|min-|has-|aria-|data-|supports-|nth-|in-)/, '');
    if (variant.startsWith('[') || variant.includes('[') || VARIANTS.has(variant) || VARIANTS.has(name)) continue;
    if (customVariants.has(variant) || customVariants.has(name)) continue;
    if (has('breakpoint', name)) continue;
    if (/^(aria|data|supports|has|nth|in|group|peer|max|min|not)-/.test(variant)) continue;
    return { kind: 'variant', message: `${variant}: is not a breakpoint or variant we have, ours are ${[...(tokens.get('breakpoint') ?? [])].join(', ')}` };
  }
  return null;
}

/* ------------------------------------------------- pulling class lists out */

/** Quoted strings inside className={...}, class="...", cx(...) and cva(...) calls. */
function classStrings(source) {
  const out = [];
  const starts = [...source.matchAll(/\bclassName\s*=|(?<![\w$.])(?:cx|clsx|cva|twMerge)\s*\(|\bclass\s*=/g)];
  for (const start of starts) {
    let i = start.index + start[0].length;
    let depth = 0;
    let guard = 0;
    while (i < source.length && guard++ < 20_000) {
      const ch = source[i];
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') {
        depth--;
        if (depth <= 0) break;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        let j = i + 1;
        let value = '';
        while (j < source.length && source[j] !== quote) {
          if (source[j] === '\\') j++;
          else if (quote === '`' && source[j] === '$' && source[j + 1] === '{') {
            // Skip an interpolation, keeping the literal parts around it.
            let braces = 1;
            j += 2;
            while (j < source.length && braces > 0) {
              if (source[j] === '{') braces++;
              if (source[j] === '}') braces--;
              j++;
            }
            value += ' ';
            continue;
          }
          value += source[j];
          j++;
        }
        out.push({ value, index: i });
        i = j;
        // className="…" is one string: stop there, rather than reading on into the JSX that follows.
        if (depth === 0 && /=\s*$/.test(start[0])) break;
      } else if (depth === 0 && (ch === ',' || ch === ';' || ch === '\n') && starts.length && source[start.index] === 'c') {
        // A bare cx( argument list ends at its closing paren, handled above.
      }
      i++;
    }
  }
  return out;
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

/* -------------------------------------------------------------------- run */

const findings = [];

function checkFile(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const source = readFileSync(file, 'utf8');
  for (const { value, index } of classStrings(source)) {
    if (!value.trim() || value.includes('\n\n')) continue;
    for (const raw of value.split(/\s+/)) {
      if (!raw || raw.length > 120) continue;
      if (!/^[a-z0-9@!:[\]()/.,%#'"$_-]+$/i.test(raw)) continue;
      // A url, a path, a css declaration or a sentence fragment that happens to sit in a class expression.
      if (raw.includes('//') || raw.includes('./') || /^[A-Z]/.test(raw)) continue;
      if (raw.endsWith(':') || raw.startsWith('(') || raw.includes('(')) continue;
      const parts = raw.split(':');
      const utility = parts.pop();
      const variantComplaint = judgeVariants(parts);
      if (variantComplaint) {
        findings.push({ file: rel, line: lineOf(source, index), class: raw, ...variantComplaint });
        continue;
      }
      const complaint = judge(utility.startsWith('-') ? utility.slice(1) : utility);
      if (complaint) findings.push({ file: rel, line: lineOf(source, index), class: raw, ...complaint });
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(tsx|ts|jsx|js)$/.test(full)) checkFile(full);
  }
}

for (const dir of SCAN) {
  try {
    walk(join(ROOT, dir));
  } catch {
    /* an optional directory */
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(findings.length > 0 ? 1 : 0);
}

if (findings.length > 0) {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.error(`\n${file} (${list.length})`);
    const seen = new Set();
    for (const f of list) {
      const key = `${f.line}:${f.class}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.error(`  ${String(f.line).padStart(4)}  ${f.message}`);
    }
  }
  const counts = findings.reduce((acc, f) => acc.set(f.kind, (acc.get(f.kind) ?? 0) + 1), new Map());
  console.error(`\n${findings.length} dead classes: ${[...counts].map(([k, n]) => `${n} ${k}`).join(', ')}`);
  console.error('These compile to nothing. Every one is a style the screen does not have.');
  process.exit(1);
}
console.log('Every class names a token we have.');
