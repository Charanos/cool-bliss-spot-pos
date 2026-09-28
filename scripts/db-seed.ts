/**
 * Seed the outlet's database. docs/17-persistence.md.
 *
 *   pnpm db:seed           builds eight weeks of trading up to now and replaces what is stored
 *   pnpm db:menu           adds whatever of the menu is missing to a database in use (scripts/db-menu.ts)
 *   pnpm db:handover       replaces what is stored with the outlet as handed over: the owner, the
 *                          roles, stock locations, the Standard price list and the real menu.
 *                          Asks for --yes, because everything else stored goes. The owner's PIN is
 *                          BLISS_OWNER_PIN, or 111111 when unset; change it in the Console at once.
 *
 * The history is generated relative to this moment: tonight is in progress with live tabs, last
 * night is closed, and the weeks before it are the record. Run it shortly before a walkthrough so
 * "tonight" is tonight. Every device resets its local trade copy on its next pull (the epoch
 * changes), and signs in again as normal; staff, devices and the menu keep their ids.
 *
 * Reads DATABASE_URL from the environment (pnpm passes .env.local). Never prints it.
 */
import { buildHandoverDataset } from '@bliss/db/seed/handover';
import { buildDataset } from '@bliss/db/seed/history';
import { hashPin } from '../modules/identity/pin-hash';
import pg from 'pg';
import { SCALARS, SCHEMA, WRITE_LOCK, databaseUrl, insertApplied, insertChanges, rowsOf, upsertRows, writeMeta } from '../modules/_data/records';

async function main() {
  const handover = process.argv.includes('--handover');
  // `--yes`, or `yes` alone, since some Windows shells treat a leading dash differently.
  if (handover && !process.argv.includes('--yes') && !process.argv.includes('yes')) {
    throw new Error('This replaces every product, person, device, tab, bill and count stored with an empty outlet and one owner. Run it again with --yes to go ahead.');
  }
  const pin = process.env.BLISS_OWNER_PIN ?? '111111';
  if (handover && !/^\d{4,8}$/.test(pin)) throw new Error('BLISS_OWNER_PIN must be four to eight digits.');
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. Put it in .env.local.');
  const started = Date.now();
  const data = handover ? buildHandoverDataset({ ownerPinHash: hashPin(pin), ownerPinLength: pin.length }) : buildDataset(Date.now());
  const rows = rowsOf(data);
  console.log(`Generated ${rows.length} rows across ${new Set(rows.map((r) => r.collection)).size} collections in ${Date.now() - started}ms.`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SCHEMA);
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock($1)', [WRITE_LOCK]);
    const previous = await client.query(`select value::text as value from bliss_meta where key = 'version'`);
    // Versions only ever rise, so every running server instance sees the reseed as newer and reloads.
    const version = (previous.rows[0] ? Number(JSON.parse(String(previous.rows[0].value))) : 0) + 1;
    await client.query('truncate bliss_record, bliss_change, bliss_applied');
    await upsertRows(client, rows, version);
    await insertChanges(client, data.changes);
    await insertApplied(client, [...data.applied], version);
    const meta: Record<string, unknown> = { version, seededAt: Date.now() };
    for (const key of SCALARS) meta[key] = (data as unknown as Record<string, unknown>)[key];
    await writeMeta(client, meta);
    await client.query('commit');
    console.log(`Seeded version ${version} in ${Date.now() - started}ms. Tonight is ${data.currentBusinessDate}; epoch ${data.epoch}.`);
    if (handover) console.log(`Handed over: ${data.staff[0]!.displayName} is the owner. Sign in to the Console with the PIN given, then add people, zones, tables and devices. The menu is in, drinks at one each until the stock take.`);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
