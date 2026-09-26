/**
 * Copy checker for the Console. docs/08-ux-copy.md, Console section, and docs/19 section 5.
 *
 * The voice is plain and exact: sentence case, the locked terms, no filler, nothing that sounds like
 * a form letter or a prototype. This reads every string a person sees in the Console (JSX text and
 * the attributes that carry words) and says where it strays. It is a guard, not a writer: a flagged
 * string is rewritten by a person, in the docs/08 voice.
 *
 * Run through `pnpm lint`, or on its own with `node scripts/check-copy.mjs`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN = ['app/(console)', 'packages/ui/src/components/console'];

/** Words that are capitalised wherever they appear: names, places, units, acronyms. */
const PROPER = new Set(
  'Bliss Console Floor Counter Cool Spot KES VAT PIN PINs CSV GRN PO SKU M-Pesa Mpesa Nairobi Kenya Tusker Tabler Friday Saturday Sunday Monday Tuesday Wednesday Thursday Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec Owner Manager OK ID Wanjiru Jane Ctrl Cmd Enter Escape Tab Shift Control Command Safaricom Guinness Smirnoff Jameson Coke Seat Table'.split(' '),
);
const SMALL = new Set('a an and as at by for from in into of on or per the to vs with'.split(' '));

const RULES = [
  { re: /\b(Oops|Uh oh|Whoops)\b/i, why: 'docs/08 bans it. Say what happened, then what to do.' },
  { re: /something went wrong/i, why: 'Say what did not happen and what is safe.' },
  { re: /\b(please|kindly)\b/i, why: 'No filler. Say what to do.' },
  { re: /\bare you sure\b/i, why: 'Name the object and the consequence instead.' },
  { re: /\binvalid (input|value|data)\b/i, why: 'Say what would be valid.' },
  { re: /\bLoading\.\.\.|\bLoading…/, why: 'Say what is loading, or show its shape.' },
  { re: /\bwe apologi[sz]e\b/i, why: 'Calm, not apologetic.' },
  { re: /—/, why: 'No em dashes (house convention).' },
  { re: /\beTIMS\b|\bKRA\b|\bfiscal(isation|ization)?\b/i, why: 'KRA eTIMS is out of scope (docs/00). Bliss does not fiscalise.' },
  { re: /\b(Apple-grade|bento|executive|operational intelligence|leakage)\b/i, why: 'Prototype language. Use the words people use at the bar.' },
  { re: /\bSubmit\b/, why: 'A button names its outcome (docs/08 section 3).' },
  { re: /\b(Delete|Remove) (the )?line\b/i, why: 'A line is voided, never deleted (terminology lock).' },
  { re: /\b(Checkout|Pay now)\b/i, why: 'Money is settled (terminology lock).' },
];

/** Two or more capitalised words of four letters or more in a row: a shouted label. */
const SHOUT = /\b[A-Z][A-Z&']{3,}(?:[ ·&/,-]+[A-Z][A-Z&']{1,}){1,}\b/;

function titleCase(text) {
  // Only labels: a sentence starts new capitals after its full stop, and that is right.
  if (/[.!?]\s/.test(text) || text.length > 60) return false;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  let caps = 0;
  for (let i = 1; i < words.length; i += 1) {
    const w = words[i].replace(/[^A-Za-z-]/g, '');
    if (!w || SMALL.has(w.toLowerCase()) || PROPER.has(w)) continue;
    if (w.length >= 3 && /^[A-Z][a-z]/.test(w)) caps += 1;
  }
  return caps >= 1;
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/** The strings a person reads: JSX text, and attributes that carry words. */
function strings(source) {
  const out = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /className=|import /.test(line) && !/>[^<{]+</.test(line)) {
      // Comments and class lists are not copy.
    }
    for (const m of line.matchAll(/\b(label|title|description|placeholder|aria-label|subtitle|header|detail|body|confirmLabel|cancelLabel|what|noun)=\s*["'`]([^"'`{}]+)["'`]/g)) out.push({ line: i + 1, text: m[2], attr: m[1] });
    for (const m of line.matchAll(/\b(label|title|description|placeholder|header|detail|body|subtitle):\s*'([^'{}]+)'/g)) out.push({ line: i + 1, text: m[2], attr: m[1] });
    if (!/^\s*(\/\/|\*|\/\*)/.test(line)) for (const m of line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) out.push({ line: i + 1, text: m[1], attr: 'text' });
  });
  return out;
}

const problems = [];
for (const dir of SCAN) {
  const abs = join(ROOT, dir);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of files(abs)) {
    const source = readFileSync(file, 'utf8');
    for (const { line, text, attr } of strings(source)) {
      const t = text.trim();
      if (!t || /^[\d\s.,:%·/+-]+$/.test(t)) continue;
      for (const rule of RULES) if (rule.re.test(t)) problems.push({ file, line, text: t, why: rule.why });
      if (SHOUT.test(t)) problems.push({ file, line, text: t, why: 'Capitals are presentation (label-caps); write the words in sentence case.' });
      if (attr !== 'text' && titleCase(t)) problems.push({ file, line, text: t, why: 'Sentence case: only the first word and names take a capital.' });
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.log(`${relative(ROOT, p.file)}:${p.line}  "${p.text}"  ${p.why}`);
  console.log(`\n${problems.length} copy ${problems.length === 1 ? 'problem' : 'problems'}. docs/08, Console section.`);
  process.exit(1);
}
console.log('Console copy reads in the docs/08 voice.');
