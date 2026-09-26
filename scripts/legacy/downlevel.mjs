/**
 * After `next build`: rewrite the client chunks the oldest supported browser cannot parse.
 *
 * Next compiles application code for the browserslist in package.json, but ships its own framework
 * chunks precompiled for Safari 16.4 (class static blocks in the App Router). Those few files are
 * passed through the SWC compiler Next already bundles, with the same targets. Minified in, minified
 * out; only chunks with a problem are touched, and the file names (content hashes) stay, since the
 * change is a faithful translation of the same program. docs/11 D-24.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { TARGETS, jsProblems } from './detect.mjs';

const require = createRequire(import.meta.url);
const ROOT = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CHUNKS = join(ROOT, '.next/static/chunks');
const swc = require(require.resolve('next/dist/build/swc', { paths: [ROOT] }));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (name.endsWith('.js')) yield path;
  }
}

await swc.loadBindings?.();
let changed = 0;
for (const path of files(CHUNKS)) {
  const source = readFileSync(path, 'utf8');
  const before = jsProblems(source);
  if (before.length === 0) continue;
  const out = await swc.transform(source, {
    jsc: { parser: { syntax: 'ecmascript' }, minify: { compress: false, mangle: false } },
    env: { targets: TARGETS },
    minify: true,
    sourceMaps: false,
    isModule: false,
  });
  const after = jsProblems(out.code);
  if (after.length > 0) {
    console.error(`downlevel: ${path.slice(ROOT.length)} still has ${after.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(path, out.code);
  changed += 1;
  console.log(`downlevel: ${path.slice(ROOT.length)} (${before.join(', ')})`);
}
console.log(`downlevel: ${changed} ${changed === 1 ? 'chunk' : 'chunks'} rewritten for Safari 15.4`);
