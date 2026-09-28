/**
 * Add the menu to a database already in use, without replacing anything. docs/17 section 3.
 *
 *   pnpm db:menu
 *
 * Adds each category, product, way of selling and Standard price from packages/db/seed/menu.ts that
 * is not stored yet: the kitchen menu and shisha on an outlet handed over before them, for instance.
 * A new drink opens with one on the Bar shelf, as at handover. A product already stored is left as
 * the owner has it (name, prices, stock), except that one with no photograph gets the menu's. The
 * outlet's phone and M-Pesa tills are filled in only where they are empty.
 *
 * Safe to run again: the second run finds everything there and changes nothing. Reads DATABASE_URL
 * from the environment (pnpm passes .env.local). Never prints it.
 */
import { buildMenu } from '@bliss/db/seed/menu';
import { OUTLET } from '@bliss/db/seed/organisation';
import { businessDate } from '@bliss/shared/time';
import pg from 'pg';
import { SCHEMA, WRITE_LOCK, databaseUrl, decode, encode, keyOf, upsertRows, writeMeta } from '../modules/_data/records';

type Row = { collection: string; id: string; ord: number | null; data: string };

async function main() {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. Put it in .env.local.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SCHEMA);
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock($1)', [WRITE_LOCK]);

    const stored = async (collection: string) => {
      const r = await client.query('select id, ord, data::text as data from bliss_record where collection = $1', [collection]);
      return { rows: new Map(r.rows.map((x) => [String(x.id), decode<Record<string, unknown>>(String(x.data))])), next: Math.max(-1, ...r.rows.map((x) => (x.ord === null ? -1 : Number(x.ord)))) + 1 };
    };
    const outletRow = (await client.query(`select data::text as data from bliss_record where collection = 'outlet'`)).rows[0];
    if (!outletRow) throw new Error('No outlet is stored. Run pnpm db:handover --yes first.');
    const outlet = decode<Record<string, unknown>>(String(outletRow.data));
    const staff = await stored('staff');
    const roles = await stored('roles');
    const ownerRole = [...roles.rows.values()].find((r) => r.key === 'owner');
    const owner = [...staff.rows.values()].find((s) => s.roleId === ownerRole?.id && s.employmentStatus === 'active') ?? [...staff.rows.values()][0];
    if (!owner) throw new Error('No one is stored to record the opening stock under.');

    const now = Date.now();
    const menu = buildMenu({ now, businessDate: businessDate(now, String(outlet.timezone ?? OUTLET.timezone), String(outlet.businessDayCutover ?? OUTLET.businessDayCutover)), ownerId: String(owner.id) });
    const lists = await stored('priceLists');
    const out: Row[] = [];
    const added: Record<string, number> = {};
    let photos = 0;

    const addNew = async <T extends object>(collection: string, rows: readonly T[], keep?: (row: NoInfer<T>) => boolean) => {
      const have = await stored(collection);
      let ord = have.next;
      const fresh = new Set<string>();
      for (const row of rows) {
        const id = keyOf(collection, row);
        if (have.rows.has(id) || (keep && !keep(row))) continue;
        out.push({ collection, id, ord: ord++, data: encode(row) });
        fresh.add(id);
      }
      added[collection] = fresh.size;
      return { have, fresh };
    };

    await addNew('categories', menu.categories);
    const products = await addNew('products', menu.products);
    // A product already stored keeps everything the owner set; only what it is missing is filled:
    // its photograph, and how many the house owns of something handed back (the shisha pots).
    for (const p of menu.products) {
      const existing = products.have.rows.get(p.id);
      if (!existing) continue;
      const patch: Record<string, unknown> = {};
      if (!existing.imageKey && p.imageKey) patch.imageKey = p.imageKey;
      if (existing.unitsInHouse == null && p.unitsInHouse) patch.unitsInHouse = p.unitsInHouse;
      if (Object.keys(patch).length === 0) continue;
      out.push({ collection: 'products', id: p.id, ord: null, data: encode({ ...existing, ...patch }) });
      if (patch.imageKey) photos += 1;
    }
    const variants = await addNew('variants', menu.variants);
    await addNew('priceListItems', menu.priceListItems, (item) => lists.rows.has(item.priceListId));
    // The choices asked on the floor, such as the shisha flavour, and which items ask them.
    await addNew('modifierGroups', menu.modifierGroups);
    await addNew('modifiers', menu.modifiers);
    await addNew('variantModifierGroups', menu.variantModifierGroups);
    // Opening stock only for a drink added now: a drink already stored has its own count.
    await addNew('movements', menu.movements, (m) => variants.fresh.has(m.productVariantId));

    const outletPatch: Record<string, unknown> = {};
    if (!outlet.phone && OUTLET.phone) outletPatch.phone = OUTLET.phone;
    if (!outlet.tills && OUTLET.tills) outletPatch.tills = OUTLET.tills;
    if (Object.keys(outletPatch).length > 0) out.push({ collection: 'outlet', id: String(outlet.id), ord: 0, data: encode({ ...outlet, ...outletPatch }) });

    if (out.length === 0) {
      await client.query('rollback');
      console.log('The menu is already all there. Nothing changed.');
      return;
    }
    const meta = await client.query(`select key, value::text as value from bliss_meta where key = any($1::text[])`, [['version', 'catalogueVersion', 'availabilityVersion']]);
    const read = (key: string) => Number(decode(String(meta.rows.find((r) => r.key === key)?.value ?? '0')));
    const version = read('version') + 1;
    // Rows written with `ord: null` are updates: keep where they already sit.
    await upsertRows(client, out, version);
    // Every server instance reloads the changed rows, and every station pulls the menu again.
    await writeMeta(client, { version, catalogueVersion: read('catalogueVersion') + 1, availabilityVersion: read('availabilityVersion') + 1 });
    await client.query('commit');
    console.log(
      `Added ${added.categories} categories, ${added.products} products, ${added.variants} ways of selling, ${added.priceListItems} prices and ${added.movements} opening counts.` +
        ` ${added.modifiers} choices. Photographs given to ${photos} products already stored.${Object.keys(outletPatch).length ? ` Outlet: ${Object.keys(outletPatch).join(' and ')} filled in.` : ''}`,
    );
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
