import 'server-only';

import type { ChangeRef, SyncTable } from '@bliss/db/seed/types';
import type { RejectionCode } from '@bliss/shared/sync';
import { dataset } from './source';

/**
 * The development change feed. docs/14 section 4. Every write through a module service records the
 * rows it touched, in order, so a device pulling with `since` receives exactly what changed. In
 * Phase 4 this is the `events` table and its sequence; the contract with the devices is the same.
 */
export function touch(table: SyncTable, ...ids: string[]): void {
  const data = dataset();
  for (const id of ids) {
    data.changeSeq += 1;
    data.changes.push({ seq: data.changeSeq, table, id });
  }
}

export function currentSeq(): number {
  return dataset().changeSeq;
}

/** The ids changed after `since`, per table, each id once. */
export function changedSince(since: number): Map<SyncTable, Set<string>> {
  const out = new Map<SyncTable, Set<string>>();
  const { changes } = dataset();
  // Changes are appended in order, so walk back from the end until the cursor.
  for (let i = changes.length - 1; i >= 0; i -= 1) {
    const change: ChangeRef = changes[i]!;
    if (change.seq <= since) break;
    const set = out.get(change.table) ?? new Set<string>();
    set.add(change.id);
    out.set(change.table, set);
  }
  return out;
}

/**
 * A command the server refuses, with the code a device can act on and a sentence a person can read.
 * Thrown by module services, caught by the sync applier, and never a bare Error for a known case.
 */
export class CommandRejected extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'CommandRejected';
  }
}
