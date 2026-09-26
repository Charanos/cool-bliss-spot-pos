/**
 * The oldest-browser gate, run in CI after the build. docs/16 section 1, docs/11 D-24.
 *
 * Every client chunk, the service worker and every stylesheet must be readable by Safari 15.4, the
 * engine on the Floor's iPad mini 4. A chunk that fails means the downlevel step missed it or a new
 * dependency brought newer syntax; a stylesheet that fails means a colour or layout feature slipped in
 * without a fallback. Either would silently break the tablet, so the build fails here instead.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cssProblems, jsProblems } from './legacy/detect.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const STATIC = join(ROOT, '.next/static');
if (!existsSync(STATIC)) {
  console.error('legacy browsers: no build found. Run pnpm build first.');
  process.exit(1);
}

function* files(dir, ext) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (name.endsWith(ext)) yield path;
  }
}

const failures = [];
let scripts = 0;
let sheets = 0;
for (const path of [...files(join(STATIC, 'chunks'), '.js'), join(ROOT, 'public/sw.js')].filter(existsSync)) {
  scripts += 1;
  const problems = jsProblems(readFileSync(path, 'utf8'));
  if (problems.length > 0) failures.push(`${path.slice(ROOT.length)}: ${problems.join(', ')}`);
}
for (const path of files(join(STATIC, 'css'), '.css')) {
  sheets += 1;
  const problems = cssProblems(readFileSync(path, 'utf8'));
  if (problems.length > 0) failures.push(`${path.slice(ROOT.length)}: ${problems.join(', ')}`);
}

if (failures.length > 0) {
  console.error(`legacy browsers: ${failures.length} ${failures.length === 1 ? 'file' : 'files'} Safari 15.4 cannot read`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`legacy browsers: ${scripts} scripts and ${sheets} stylesheets read in Safari 15.4 and Chrome 111`);
