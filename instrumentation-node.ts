import { boot, storeEnabled } from './modules/_data/store';

/** Load the outlet from Postgres before the first request. Skipped while building. */
export async function start(): Promise<void> {
  if (process.env.NEXT_PHASE === 'phase-production-build' || !storeEnabled()) return;
  await boot();
}
