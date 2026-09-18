import 'server-only';

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataset } from '@bliss/db/seed/history';
import type { Dataset } from '@bliss/db/seed/types';

/**
 * The development data source. One generated dataset per server process, mutated in memory by the
 * module services so Console actions such as placing a hold behave end to end during development.
 *
 * This is the seam Phase 1 replaces with Drizzle against Neon. Nothing outside modules/*\/schema.ts
 * touches it, and no module reaches another module's schema: cross-module reads go through services.
 */

const globalForData = globalThis as unknown as { __blissDataset?: Dataset; __blissRevision?: string };

/**
 * The generator's revision, from the seed files on disk. In development each route bundle, and the
 * server action bundle, holds its own copy of the generator module, compiled differently, so neither
 * function identity nor function text is stable across them: either would rebuild on a route change
 * and silently drop every write made before it. File modification times are the same from every
 * bundle and move when any seed file is edited.
 */
function revision(): string {
  try {
    const dir = join(process.cwd(), 'packages', 'db', 'seed');
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => `${f}:${statSync(join(dir, f)).mtimeMs}`)
      .join('|');
  } catch {
    return 'static';
  }
}

let checkedAt = 0;
let current = '';

export function dataset(): Dataset {
  // Reading the directory costs a few syscalls, so look at most once a second.
  const now = Date.now();
  if (now - checkedAt > 1000) {
    current = revision();
    checkedAt = now;
  }
  if (!globalForData.__blissDataset || globalForData.__blissRevision !== current) {
    globalForData.__blissDataset = buildDataset(now);
    globalForData.__blissRevision = current;
  }
  return globalForData.__blissDataset;
}

/** Bump whenever a write changes what the floor can sell, so clients detect a stale snapshot. */
export function bumpAvailabilityVersion(): number {
  const data = dataset();
  data.availabilityVersion += 1;
  return data.availabilityVersion;
}

/** Bump whenever a catalogue or price change must reach the floor's cached snapshot. */
export function bumpCatalogueVersion(): number {
  const data = dataset();
  data.catalogueVersion += 1;
  return data.catalogueVersion;
}
