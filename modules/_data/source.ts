import 'server-only';

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDataset } from '@bliss/db/seed/history';
import type { Dataset } from '@bliss/db/seed/types';
import { storeDataset, storeEnabled } from './store';

/**
 * The outlet's data. With DATABASE_URL set, Postgres holds it and store.ts keeps each server
 * instance's working set in step with it (docs/17-persistence.md). Without one, as in the tests, it
 * is a dataset generated in memory per process.
 *
 * Nothing outside modules/*\/schema.ts
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
  // With a database, the working set is loaded from Postgres and every write is made permanent
  // there (store.ts). Without one (tests, BLISS_STORE=memory) it is generated here, in memory.
  if (storeEnabled()) return storeDataset();
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
