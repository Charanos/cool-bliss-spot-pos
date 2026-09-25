import type { Dataset } from '@bliss/db/seed/types';

/**
 * How the outlet's data sits in Postgres. docs/17-persistence.md.
 *
 * Every collection of the working set (tabs, lines, bills, movements, staff...) is a set of rows in
 * `bliss_record`, one per entity, keyed by collection and id, its body as jsonb, stamped with the
 * version of the write that last touched it. Three small tables sit beside it: the device change
 * feed, the outbox entries already applied, and the counters.
 *
 * No `server-only` here: the seed script runs this outside Next.
 */

/** The collections of the working set, in the order they load. `changes` has its own table. */
export const COLLECTIONS = [
  'roles',
  'staff',
  'devices',
  'zones',
  'tables',
  'locations',
  'suppliers',
  'categories',
  'products',
  'variants',
  'modifierGroups',
  'modifiers',
  'variantModifierGroups',
  'priceLists',
  'priceListItems',
  'priceRules',
  'recipes',
  'pourSpecs',
  'tabs',
  'seats',
  'orders',
  'lines',
  'lineModifiers',
  'bills',
  'billLines',
  'tenders',
  'shifts',
  'drawerSessions',
  'movements',
  'holds',
  'counts',
  'countLines',
  'stockBatches',
  'goodsReceivedNotes',
  'purchaseOrders',
  'purchaseOrderLines',
  'receipts',
  'receiptLines',
  'supplierProducts',
  'auditEvents',
  'deadLetters',
  'presence',
  'cashMovements',
] as const satisfies readonly (keyof Dataset)[];

export type Collection = (typeof COLLECTIONS)[number];

/** Single objects rather than lists. Stored as one row each. */
export const SINGLETONS = ['outlet'] as const satisfies readonly (keyof Dataset)[];

/** The counters and settings kept in `bliss_meta`. */
export const SCALARS = ['epoch', 'catalogueVersion', 'availabilityVersion', 'changeSeq', 'firstBusinessDate', 'generatedAt'] as const satisfies readonly (keyof Dataset)[];

/** The key of a row within its collection. Most rows carry an id; three are keyed by what they describe. */
export function keyOf(collection: string, row: object): string {
  const r = row as Record<string, unknown>;
  if (collection === 'variantModifierGroups') return `${String(r.productVariantId)}:${String(r.modifierGroupId)}`;
  if (collection === 'presence') return String(r.deviceId);
  if (collection === 'pourSpecs') return String(r.productVariantId);
  if (typeof r.id === 'string' && r.id) return r.id;
  throw new Error(`A ${collection} row has no id to store it under.`);
}

/**
 * Lossless JSON. Money is bigint throughout, and JSON has no bigint, so a bigint is written as
 * {"$n":"12345"} and read back as a bigint wherever it sits, whatever the field is called.
 */
export function encode(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? { $n: v.toString() } : v));
}

export function decode<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (typeof o.$n === 'string' && Object.keys(o).length === 1) return BigInt(o.$n);
    }
    return v;
  });
}

export const SCHEMA = `
create table if not exists bliss_record (
  collection text not null,
  id text not null,
  ord integer,
  data jsonb not null,
  version bigint not null,
  primary key (collection, id)
);
create index if not exists bliss_record_version on bliss_record (version);
create index if not exists bliss_record_order on bliss_record (collection, ord);
create table if not exists bliss_meta (key text primary key, value jsonb not null);
create table if not exists bliss_change (seq bigint primary key, tbl text not null, id text not null);
create table if not exists bliss_applied (id text primary key, version bigint not null);
`;

/** The advisory lock every write holds for its transaction, so writes apply one at a time. */
export const WRITE_LOCK = 4_242_017;

/** Minimal client surface, so the seed script and the server share these helpers. */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const BATCH = 1000;

/** Upsert rows in batches. `ord` is kept on conflict: a row never moves once written. */
export async function upsertRows(db: Queryable, rows: { collection: string; id: string; ord: number | null; data: string }[], version: number): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.query(
      `insert into bliss_record (collection, id, ord, data, version)
       select c, i, o, d::jsonb, $5 from unnest($1::text[], $2::text[], $3::int[], $4::text[]) as t(c, i, o, d)
       on conflict (collection, id) do update set data = excluded.data, version = excluded.version`,
      [chunk.map((r) => r.collection), chunk.map((r) => r.id), chunk.map((r) => r.ord), chunk.map((r) => r.data), version],
    );
  }
}

export async function writeMeta(db: Queryable, values: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(values);
  await db.query(
    `insert into bliss_meta (key, value) select k, v::jsonb from unnest($1::text[], $2::text[]) as t(k, v)
     on conflict (key) do update set value = excluded.value`,
    [keys, keys.map((k) => encode(values[k]))],
  );
}

export async function insertChanges(db: Queryable, changes: readonly { seq: number; table: string; id: string }[]): Promise<void> {
  for (let i = 0; i < changes.length; i += BATCH) {
    const chunk = changes.slice(i, i + BATCH);
    await db.query(
      `insert into bliss_change (seq, tbl, id) select s, t, i from unnest($1::bigint[], $2::text[], $3::text[]) as x(s, t, i) on conflict (seq) do nothing`,
      [chunk.map((c) => c.seq), chunk.map((c) => c.table), chunk.map((c) => c.id)],
    );
  }
}

export async function insertApplied(db: Queryable, ids: readonly string[], version: number): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    await db.query(`insert into bliss_applied (id, version) select i, $2 from unnest($1::text[]) as t(i) on conflict (id) do nothing`, [chunk, version]);
  }
}

/** Every row of a dataset, ready to write, with its position in its collection. */
export function rowsOf(data: Dataset): { collection: string; id: string; ord: number | null; data: string }[] {
  const out: { collection: string; id: string; ord: number | null; data: string }[] = [];
  for (const collection of COLLECTIONS) {
    const list = data[collection] as unknown as object[];
    list.forEach((row, ord) => out.push({ collection, id: keyOf(collection, row), ord, data: encode(row) }));
  }
  for (const single of SINGLETONS) {
    const row = data[single] as unknown as object;
    out.push({ collection: single, id: keyOf(single, row), ord: 0, data: encode(row) });
  }
  return out;
}

/**
 * The connection string with TLS verified in full. Neon's certificates are public, so this is the
 * strict setting, and it is what `sslmode=require` is about to mean in node-postgres anyway.
 */
export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  return url?.replace(/sslmode=(require|prefer)\b/, 'sslmode=verify-full');
}
