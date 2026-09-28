import 'server-only';

import { type IntervalHistogram, monitorEventLoopDelay } from 'node:perf_hooks';
import { ping } from '../_data/store';

/**
 * The server's vital signs over the last hour, for Settings, Health: how fast the database
 * answers, how much memory the process holds, and how long the event loop waits. Sampled at most
 * every 30 seconds, by the Console's heartbeat and by the Health page itself, and kept in this
 * server's memory only: a restart starts the history again, which the page says.
 */

export interface VitalSample {
  at: number;
  /** Database round trip; null with no database, or when it did not answer. */
  dbMs: number | null;
  dbOk: boolean;
  heapMb: number;
  rssMb: number;
  /** How long work waited for the event loop, the 99th percentile since the last sample. */
  loopMs: number;
}

const EVERY_MS = 30_000;
const KEEP = 120;

interface VitalsState {
  samples: VitalSample[];
  histogram: IntervalHistogram | null;
  pending: Promise<VitalSample> | null;
}

const state = ((globalThis as unknown as { __blissVitals?: VitalsState }).__blissVitals ??= { samples: [], histogram: null, pending: null });

function loop(): IntervalHistogram | null {
  if (state.histogram) return state.histogram;
  try {
    state.histogram = monitorEventLoopDelay({ resolution: 20 });
    state.histogram.enable();
  } catch {
    state.histogram = null;
  }
  return state.histogram;
}

/** Take a sample unless one was taken in the last 30 seconds; either way, the latest. */
export async function sampleVitals(options: { force?: boolean } = {}): Promise<VitalSample> {
  const last = state.samples.at(-1);
  if (last && !options.force && Date.now() - last.at < EVERY_MS) return last;
  if (state.pending) return state.pending;
  state.pending = (async () => {
    const h = loop();
    const db = await ping();
    const mem = process.memoryUsage();
    const loopMs = h && h.count > 0 ? Math.round((h.percentile(99) / 1e6) * 10) / 10 : 0;
    h?.reset();
    const sample: VitalSample = {
      at: Date.now(),
      dbMs: db && 'ms' in db ? db.ms : null,
      dbOk: db === null || 'ms' in db,
      heapMb: Math.round(mem.heapUsed / 1_048_576),
      rssMb: Math.round(mem.rss / 1_048_576),
      loopMs,
    };
    state.samples.push(sample);
    if (state.samples.length > KEEP) state.samples.splice(0, state.samples.length - KEEP);
    return sample;
  })().finally(() => {
    state.pending = null;
  });
  return state.pending;
}

/** Every sample kept, oldest first. */
export function vitals(): readonly VitalSample[] {
  return state.samples;
}
