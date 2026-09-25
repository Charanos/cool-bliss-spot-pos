import 'server-only';

import { tradingClock } from '@bliss/db/seed/history';
import type { ChangeRef, Dataset, SyncTable } from '@bliss/db/seed/types';
import { Pool, type PoolClient } from 'pg';
import { COLLECTIONS, SCALARS, SCHEMA, SINGLETONS, WRITE_LOCK, databaseUrl, decode, encode, insertApplied, insertChanges, keyOf, upsertRows, writeMeta } from './records';

/**
 * The outlet's data, held in Postgres and worked on in memory. docs/17-persistence.md.
 *
 * Postgres is the truth. Each server instance loads the whole working set once when it starts
 * (instrumentation.ts), and the module services keep reading and changing it synchronously, as
 * they always have. What changed is how a change becomes permanent:
 *
 *   write   one Postgres transaction under an advisory lock: catch up to the latest version,
 *           apply the command in memory with every touched row recorded, write exactly those
 *           rows, the new change feed entries and the counters, commit. If anything fails, the
 *           memory is put back as it was and nothing is written.
 *   read    a device facing read first asks Postgres for the current version (one row) and, if
 *           another instance has written since, loads only the rows newer than what it holds.
 *
 * So two tablets hitting two different server instances see one outlet, and a restart, a deploy
 * or a cold start loses nothing.
 *
 * Tracking is on only inside a write. There, `dataset()` hands out a view whose arrays and rows
 * are proxies: a push into a collection, or a field set on a row or anything inside it, marks
 * that row for writing and keeps a copy of what it was, so the write can be taken back whole, or
 * back to a checkpoint (one outbox entry that the server refuses leaves no trace).
 */

const g = globalThis as unknown as { __blissStore?: StoreState };

interface StoreState {
  pool: Pool;
  data: Dataset | null;
  /** The version of the data this instance holds. */
  loaded: number;
  booting: Promise<void> | null;
  checking: Promise<void> | null;
  checkedAt: number;
  /** Writes in this instance, one after another. The advisory lock orders them across instances. */
  queue: Promise<unknown>;
}

export function storeEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL) && process.env.BLISS_STORE !== 'memory';
}

function state(): StoreState {
  if (!g.__blissStore) {
    g.__blissStore = {
      pool: new Pool({ connectionString: databaseUrl(), max: 5, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 15_000 }),
      data: null,
      loaded: 0,
      booting: null,
      checking: null,
      checkedAt: 0,
      queue: Promise.resolve(),
    };
  }
  return g.__blissStore;
}

/* ------------------------------------------------------------------ load */

/** The date fields follow the clock, not the moment the data was seeded. */
function liveClock(data: Dataset): Dataset {
  for (const [key, read] of [
    ['now', () => Date.now()],
    ['currentBusinessDate', () => tradingClock(Date.now()).current],
    ['lastNight', () => tradingClock(Date.now()).lastNight],
    ['tradingInProgress', () => tradingClock(Date.now()).inProgress],
  ] as const) {
    Object.defineProperty(data, key, { get: read, enumerable: true, configurable: true });
  }
  return data;
}

async function hydrate(db: PoolClient | Pool): Promise<void> {
  const s = state();
  const meta = new Map((await db.query('select key, value::text as value from bliss_meta')).rows.map((r) => [String(r.key), decode(String(r.value))]));
  const version = Number(meta.get('version') ?? 0);
  if (version === 0) throw new Error('The database has no outlet data yet. Run pnpm db:seed first.');

  const data = {} as Record<string, unknown>;
  for (const c of COLLECTIONS) data[c] = [];
  const records = await db.query('select collection, data::text as data from bliss_record order by collection, ord nulls last');
  for (const r of records.rows) {
    const collection = String(r.collection);
    const row = decode<object>(String(r.data));
    if ((SINGLETONS as readonly string[]).includes(collection)) data[collection] = row;
    else if (Array.isArray(data[collection])) (data[collection] as object[]).push(row);
  }
  for (const key of SCALARS) data[key] = meta.get(key);
  data.changes = (await db.query('select seq, tbl, id from bliss_change order by seq')).rows.map((r) => ({ seq: Number(r.seq), table: r.tbl as SyncTable, id: String(r.id) }));
  data.applied = new Set((await db.query('select id from bliss_applied')).rows.map((r) => String(r.id)));
  s.data = liveClock(data as unknown as Dataset);
  s.loaded = version;
  s.checkedAt = Date.now();
}

/** Load the working set once per instance. Called from instrumentation.ts, and lazily by `ready`. */
export function boot(): Promise<void> {
  const s = state();
  if (s.data) return Promise.resolve();
  if (!s.booting) {
    const started = Date.now();
    s.booting = s.pool
      .query(SCHEMA)
      .then(() => hydrate(s.pool))
      .then(() => console.info(`[bliss] loaded the outlet from Postgres in ${Date.now() - started}ms`))
      .catch((error) => {
        s.booting = null;
        throw error;
      });
  }
  return s.booting;
}

/** The working set, for `dataset()`. Inside a write, the tracked view. */
export function storeDataset(): Dataset {
  const s = state();
  if (!s.data) throw new Error('The outlet data is still loading. Try again in a moment.');
  if (tracking && txn) return txn.view;
  // Reads that did not ask for freshness still catch up soon: at most a second behind.
  if (!writing && Date.now() - s.checkedAt > 1000) void fresh().catch(() => undefined);
  return s.data;
}

/* ------------------------------------------------------------- catching up */

async function catchUp(db: PoolClient | Pool, to: number): Promise<void> {
  const s = state();
  const data = s.data as unknown as Record<string, unknown> & Dataset;
  // A reseed starts a new epoch and replaces everything: load it whole rather than patch.
  const epoch = await db.query(`select value::text as value from bliss_meta where key = 'epoch'`);
  if (epoch.rows[0] && decode(String(epoch.rows[0].value)) !== data.epoch) return hydrate(db);
  const from = s.loaded;
  const rows = await db.query('select collection, id, ord, data::text as data from bliss_record where version > $1 order by collection, ord nulls last', [from]);
  const byCollection = new Map<string, { id: string; ord: number | null; row: object }[]>();
  for (const r of rows.rows) {
    const list = byCollection.get(String(r.collection)) ?? [];
    list.push({ id: String(r.id), ord: r.ord === null ? null : Number(r.ord), row: decode<object>(String(r.data)) });
    byCollection.set(String(r.collection), list);
  }
  for (const [collection, list] of byCollection) {
    if ((SINGLETONS as readonly string[]).includes(collection)) {
      data[collection] = list[list.length - 1]!.row;
      continue;
    }
    const current = data[collection] as object[] | undefined;
    if (!current) continue;
    // A new array, so every index a service keeps over the old one sees a different source and rebuilds.
    const next = current.slice();
    const at = new Map(next.map((row, i) => [keyOf(collection, row), i]));
    for (const { id, row } of list) {
      const i = at.get(id);
      if (i === undefined) {
        at.set(id, next.length);
        next.push(row);
      } else next[i] = row;
    }
    data[collection] = next;
  }
  const changes = await db.query('select seq, tbl, id from bliss_change where seq > $1 order by seq', [data.changeSeq]);
  for (const r of changes.rows) data.changes.push({ seq: Number(r.seq), table: r.tbl as SyncTable, id: String(r.id) });
  for (const r of (await db.query('select id from bliss_applied where version > $1', [from])).rows) data.applied.add(String(r.id));
  for (const r of (await db.query('select key, value::text as value from bliss_meta where key = any($1::text[])', [[...SCALARS]])).rows) {
    data[String(r.key)] = decode(String(r.value));
  }
  s.loaded = to;
}

async function versionOf(db: PoolClient | Pool): Promise<number> {
  const r = await db.query(`select value::text as value from bliss_meta where key = 'version'`);
  return r.rows[0] ? Number(decode(String(r.rows[0].value))) : 0;
}

/**
 * Make sure this instance holds the latest committed version. Every device facing route awaits
 * this first; concurrent callers share one check.
 */
export async function fresh(): Promise<void> {
  if (!storeEnabled()) return;
  await boot();
  const s = state();
  if (s.checking) return s.checking;
  s.checking = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await s.pool.connect();
      // One snapshot: the version and the rows it names are read at the same instant.
      await client.query('begin isolation level repeatable read read only');
      const latest = await versionOf(client);
      if (latest > s.loaded && !writing) await catchUp(client, latest);
      await client.query('commit');
      s.checkedAt = Date.now();
    } catch (error) {
      await client?.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client?.release();
      s.checking = null;
    }
  })();
  return s.checking;
}

/** The data is loaded; freshness not required. For reads that tolerate a second of lag. */
export async function ready(): Promise<void> {
  if (storeEnabled()) await boot();
}

/* ------------------------------------------------------------------ writes */

const RAW = Symbol('bliss.raw');
const COLLECTION_SET = new Set<string>(COLLECTIONS);

interface Frame {
  pre: Map<object, object>;
  lengths: Map<unknown[], number>;
  replaced: [unknown[], number, unknown][];
  dirtyAdded: string[];
  appliedAdded: string[];
  scalars: Map<string, unknown>;
  changesLength: number;
}

interface Txn {
  view: Dataset;
  dirty: Map<string, { collection: string; row: object; ord: number | null }>;
  frames: Frame[];
  baseChangeSeq: number;
}

let txn: Txn | null = null;
/** True only while a write's command runs, which is synchronous: nothing else interleaves. */
let tracking = false;
/** True from the start of a write to its end, so a background catch-up waits its turn. */
let writing = false;

function frame(data: Dataset): Frame {
  return { pre: new Map(), lengths: new Map(), replaced: [], dirtyAdded: [], appliedAdded: [], scalars: new Map(), changesLength: data.changes.length };
}

function top(): Frame {
  return txn!.frames[txn!.frames.length - 1]!;
}

function unwrap<T>(value: T): T {
  if (value && typeof value === 'object') {
    const raw = (value as Record<symbol, unknown>)[RAW];
    if (raw) return raw as T;
    // A literal built by spreading a tracked row carries tracked nested values; store their raw forms.
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) value[i] = unwrap(value[i]);
    } else if (Object.getPrototypeOf(value) === Object.prototype) {
      for (const k of Object.keys(value)) (value as Record<string, unknown>)[k] = unwrap((value as Record<string, unknown>)[k]);
    }
  }
  return value;
}

function markDirty(collection: string, row: object, ord: number | null) {
  if (!txn) return;
  const key = `${collection}\u0000${keyOf(collection, row)}`;
  const known = txn.dirty.get(key);
  if (known) {
    known.row = row;
    if (ord !== null) known.ord = ord;
    return;
  }
  txn.dirty.set(key, { collection, row, ord });
  top().dirtyAdded.push(key);
}

function remember(row: object) {
  if (!txn) return;
  const f = top();
  if (!f.pre.has(row)) f.pre.set(row, structuredClone(row));
}

const proxies = new WeakMap<object, object>();

function tracked<T extends object>(target: T, collection: string, owner: object): T {
  const cached = proxies.get(target);
  if (cached) return cached as T;
  const proxy = new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === RAW) return t;
      const v = Reflect.get(t, prop, receiver) as unknown;
      return v && typeof v === 'object' && typeof prop === 'string' ? tracked(v as object, collection, owner) : v;
    },
    set(t, prop, value) {
      if (tracking) {
        remember(owner);
        markDirty(collection, owner, null);
      }
      (t as Record<PropertyKey, unknown>)[prop] = unwrap(value);
      return true;
    },
    deleteProperty(t, prop) {
      if (tracking) {
        remember(owner);
        markDirty(collection, owner, null);
      }
      return Reflect.deleteProperty(t, prop);
    },
  });
  proxies.set(target, proxy);
  return proxy;
}

const isIndex = (prop: PropertyKey): boolean => typeof prop === 'string' && /^\d+$/.test(prop);

function trackedCollection(collection: string, list: unknown[]): unknown[] {
  const cached = proxies.get(list);
  if (cached) return cached as unknown[];
  const proxy = new Proxy(list, {
    get(t, prop, receiver) {
      if (prop === RAW) return t;
      const v = Reflect.get(t, prop, receiver) as unknown;
      return isIndex(prop) && v && typeof v === 'object' ? tracked(v as object, collection, v as object) : v;
    },
    set(t, prop, value) {
      if (isIndex(prop)) {
        const i = Number(prop as string);
        const raw = unwrap(value) as object;
        if (tracking && txn) {
          const f = top();
          if (!f.lengths.has(t)) f.lengths.set(t, t.length);
          if (i < t.length && t[i] !== raw) f.replaced.push([t, i, t[i]]);
          markDirty(collection, raw, i);
        }
        t[i] = raw;
        return true;
      }
      if (prop === 'length' && tracking && txn && !top().lengths.has(t)) top().lengths.set(t, t.length);
      return Reflect.set(t, prop, value);
    },
  });
  proxies.set(list, proxy);
  return proxy;
}

function trackedRoot(data: Dataset): Dataset {
  return new Proxy(data, {
    get(t, prop, receiver) {
      if (typeof prop === 'string' && COLLECTION_SET.has(prop)) return trackedCollection(prop, (t as unknown as Record<string, unknown[]>)[prop]!);
      if (typeof prop === 'string' && (SINGLETONS as readonly string[]).includes(prop)) {
        const row = (t as unknown as Record<string, object>)[prop]!;
        return tracked(row, prop, row);
      }
      if (prop === 'applied') {
        const set = t.applied;
        return {
          has: (id: string) => set.has(id),
          get size() {
            return set.size;
          },
          add(id: string) {
            if (!set.has(id) && tracking && txn) top().appliedAdded.push(id);
            set.add(id);
            return this;
          },
        };
      }
      return Reflect.get(t, prop, receiver);
    },
    set(t, prop, value) {
      if (typeof prop === 'string' && tracking && txn) {
        const f = top();
        if (!f.scalars.has(prop)) f.scalars.set(prop, (t as unknown as Record<string, unknown>)[prop]);
      }
      (t as unknown as Record<PropertyKey, unknown>)[prop] = value;
      return true;
    },
  });
}

function undo(f: Frame, data: Dataset) {
  for (const [row, before] of f.pre) {
    for (const k of Object.keys(row)) delete (row as Record<string, unknown>)[k];
    Object.assign(row, before);
  }
  for (const [list, i, previous] of f.replaced.reverse()) list[i] = previous;
  for (const [list, length] of f.lengths) list.length = length;
  for (const key of f.dirtyAdded) txn?.dirty.delete(key);
  for (const id of f.appliedAdded) data.applied.delete(id);
  for (const [key, value] of f.scalars) (data as unknown as Record<string, unknown>)[key] = value;
  data.changes.length = f.changesLength;
}

export interface Checkpoint {
  depth: number;
}

/** Mark a point the current write can go back to. Outside a write, nothing to mark. */
export function checkpoint(): Checkpoint | null {
  if (!txn || !tracking) return null;
  txn.frames.push(frame(state().data!));
  return { depth: txn.frames.length };
}

/** Undo everything since the checkpoint, and forget it. */
export function rollbackTo(cp: Checkpoint | null): void {
  if (!cp || !txn) return;
  while (txn.frames.length >= cp.depth) undo(txn.frames.pop()!, state().data!);
}

/** Keep everything since the checkpoint as part of the write around it. */
export function release(cp: Checkpoint | null): void {
  if (!cp || !txn) return;
  while (txn.frames.length >= cp.depth) {
    const f = txn.frames.pop()!;
    const parent = top();
    for (const [row, before] of f.pre) if (!parent.pre.has(row)) parent.pre.set(row, before);
    for (const [list, length] of f.lengths) if (!parent.lengths.has(list)) parent.lengths.set(list, length);
    parent.replaced.push(...f.replaced);
    parent.dirtyAdded.push(...f.dirtyAdded);
    parent.appliedAdded.push(...f.appliedAdded);
    for (const [key, value] of f.scalars) if (!parent.scalars.has(key)) parent.scalars.set(key, value);
  }
}

async function persist(client: PoolClient, data: Dataset, version: number, t: Txn) {
  const rows = [...t.dirty.values()].map((d) => ({ collection: d.collection, id: keyOf(d.collection, d.row), ord: d.ord, data: encode(d.row) }));
  if (rows.length > 0) await upsertRows(client, rows, version);
  const changes: ChangeRef[] = data.changes.filter((c) => c.seq > t.baseChangeSeq);
  if (changes.length > 0) await insertChanges(client, changes);
  const applied = t.frames.flatMap((f) => f.appliedAdded);
  if (applied.length > 0) await insertApplied(client, applied, version);
  const meta: Record<string, unknown> = { version };
  for (const key of SCALARS) meta[key] = (data as unknown as Record<string, unknown>)[key];
  await writeMeta(client, meta);
}

/**
 * Run a change and make it permanent. The command runs synchronously against the tracked view;
 * its result is returned once Postgres has committed it. If the command throws, or the write
 * fails, the working set is put back as it was and the error comes through.
 *
 * Without a database (tests, or BLISS_STORE=memory) the command simply runs.
 */
export async function withWrite<T>(command: () => T): Promise<T> {
  if (!storeEnabled()) return command();
  await boot();
  const s = state();
  const run = s.queue.then(async () => {
    const client = await s.pool.connect();
    writing = true;
    let t: Txn | null = null;
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock($1)', [WRITE_LOCK]);
      const latest = await versionOf(client);
      if (latest > s.loaded) await catchUp(client, latest);
      const data = s.data!;
      t = { view: trackedRoot(data), dirty: new Map(), frames: [frame(data)], baseChangeSeq: data.changeSeq };
      txn = t;
      tracking = true;
      let result: T;
      try {
        result = command();
      } finally {
        tracking = false;
      }
      const next = latest + 1;
      if (t.dirty.size > 0 || t.frames.some((f) => f.appliedAdded.length > 0 || f.scalars.size > 0)) {
        await persist(client, data, next, t);
        await client.query('commit');
        s.loaded = next;
      } else {
        await client.query('commit');
      }
      s.checkedAt = Date.now();
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      if (t && s.data) while (t.frames.length > 0) undo(t.frames.pop()!, s.data);
      throw error;
    } finally {
      txn = null;
      writing = false;
      client.release();
    }
  });
  s.queue = run.catch(() => undefined);
  return run;
}
