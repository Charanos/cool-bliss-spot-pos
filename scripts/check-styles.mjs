/**
 * Style rules ESLint cannot see, because they live in CSS: no raw colour outside the token file and
 * no font weight above 500. docs/06-design-system.md sections 3 and 9.
 *
 * In components: no color-mix() in an inline style. A class goes through the build, which turns it
 * into rgb() the iPad's Safari 15 reads; an inline style reaches the browser as written, where it is
 * invalid and silently dropped. docs/11 D-24.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCAN = ['app', 'packages/ui/src'];
const ALLOW = new Set(['packages/ui/src/styles/tokens.css']);
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (full.endsWith('.css')) check(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) checkInline(full);
  }
}

function check(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOW.has(rel)) return;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(\s*\d/.test(line)) failures.push(`${rel}:${i + 1} raw colour`);
    const weight = line.match(/font-weight\s*:\s*(\d{3})/);
    if (weight && Number(weight[1]) > 500) failures.push(`${rel}:${i + 1} font weight ${weight[1]}`);
  });
}

function checkInline(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel.endsWith('.test.ts') || rel.endsWith('tokens.ts')) return;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // A Tailwind class writes it as color-mix(in_oklab,...): that one is compiled, and fine.
      if (/color-mix\(in /.test(line)) failures.push(`${rel}:${i + 1} color-mix() in an inline style: use a class or rgb(var(--bliss-x-rgb) / n%)`);
    });
}

for (const dir of SCAN) walk(join(ROOT, dir));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Styles use tokens only.');
