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
import { readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { files, problemsIn } from './copy-rules.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN = ['app/(console)', 'packages/ui/src/components/console'];

const problems = [];
for (const dir of SCAN) {
  const abs = join(ROOT, dir);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of files(abs)) for (const p of problemsIn(readFileSync(file, 'utf8'))) problems.push({ file, ...p });
}

if (problems.length > 0) {
  for (const p of problems) console.log(`${relative(ROOT, p.file)}:${p.line}  "${p.text}"  ${p.why}`);
  console.log(`\n${problems.length} copy ${problems.length === 1 ? 'problem' : 'problems'}. docs/08, Console section.`);
  process.exit(1);
}
console.log('Console copy reads in the docs/08 voice.');
