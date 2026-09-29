import 'server-only';

import { MENU, skuOf } from '@bliss/db/seed/menu';
import { menuImage } from '@bliss/db/seed/menu-images';
import { seedId } from '@bliss/db/seed/ids';
import type { Product, ProductVariant, TenderKind } from '@bliss/shared/domain';
import { type Cents, ZERO, formatKes, multiplyByQty, shillings, sum } from '@bliss/shared/money';
import type { Actor } from '@bliss/shared/reason';
import { type IsoDate, businessDayWindow } from '@bliss/shared/time';
import { DomainError } from '../_data/errors';
import { dataset } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogueManage from '../catalogue/manage';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as pricingManage from '../pricing/manage';
import * as pricing from '../pricing/service';
import * as settlementCommands from '../settlement/commands';
import * as settlement from '../settlement/service';
import * as inventory from './service';
import { SHEET_2026_09_28 } from './sheets/2026-09-28';

/**
 * A paper stock sheet, booked into Bliss after the night it records. docs/05 section 2.4.
 *
 * A bar that counted and sold on paper hands over three things: what was on the shelf when the night
 * opened (O.S), what was sold, and what was on the shelf when it closed (C.STOCK). They go in as the
 * stations would have written them, on the business day of the sheet, not today:
 *
 *   1. at the day's opening, each item is counted to its opening figure at the bar, and to nothing
 *      anywhere else, as count adjustments;
 *   2. the night's sales are one settled bill, its lines at the prices on the sheet, taking stock as
 *      any sale does;
 *   3. at the day's close, each item is counted again, to its closing figure. Where the shelf holds
 *      what the sales leave, nothing moves; where it holds less, the gap is a variance on the record,
 *      as a real count would show it. A bottle a tot was poured from still counts as a bottle on the
 *      sheet, so a pour smaller than a whole unit is not a variance.
 *
 * Anything Bliss recorded after the close (a Tuesday sale on a station) stays on top, so on hand now
 * is the closing count carried forward. The sheet also brings the menu up to what the bar sells: tots,
 * cigarettes by the stick, a price set that night. Applied once: the bill it writes is the marker.
 */

export type SheetWay = 'bottle' | 'tot' | 'stick' | 'pack';

export interface StockSheet {
  id: string;
  title: string;
  businessDate: IsoDate;
  counts: { item: string; opening: number; closing: number; note?: string }[];
  sales: { item: string; way?: SheetWay; qty: number; price: number }[];
  tenders: { kind: Exclude<TenderKind, 'cash'>; amount: number; reference: string }[];
  menu: {
    totMl: number;
    tots: { item: string; price: number; bottleMl?: number }[];
    newProducts: { name: string; category: string; bottleMl: number }[];
    sticks: { item: string; stick: number; pack: number }[];
    prices: { item: string; price: number }[];
  };
}

export const SHEETS: readonly StockSheet[] = [SHEET_2026_09_28];

export function sheetById(id: string): StockSheet | null {
  return SHEETS.find((s) => s.id === id) ?? null;
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
const MINUTE = 60_000;
const PACK = 20;

/* ------------------------------------------------------------------ reading */

/** The product a sheet line names: by its name, or by the menu's own id if it has been renamed. */
function productFor(name: string): Product | null {
  const wanted = name.trim().toLowerCase();
  const products = catalogue.products();
  const byName = products.find((p) => p.name.trim().toLowerCase() === wanted && p.status === 'active') ?? products.find((p) => p.name.trim().toLowerCase() === wanted);
  if (byName) return byName;
  for (const section of MENU) {
    if (!section.code) continue;
    const found = catalogue.productById(seedId(`menu:product:${skuOf(section.code, name)}`));
    if (found) return found;
  }
  return null;
}

function sealedOf(product: Product): ProductVariant | null {
  return catalogue.variants().find((v) => v.productId === product.id && v.kind === 'sealed') ?? null;
}

const totName = (product: Product) => `${product.name}, tot`;
const stickName = (product: Product) => `${product.name}, stick`;
const packName = (product: Product) => `${product.name}, pack of ${PACK}`;

function variantNamed(product: Product, name: string): ProductVariant | null {
  const wanted = name.toLowerCase();
  return catalogue.variants().find((v) => v.productId === product.id && v.status === 'active' && v.name.toLowerCase() === wanted) ?? null;
}

/** The way of selling a sale line is for, once the sheet's menu is in place. */
function variantFor(product: Product, way: SheetWay = 'bottle'): ProductVariant | null {
  if (way === 'tot') return variantNamed(product, totName(product));
  if (way === 'pack') return variantNamed(product, packName(product));
  return sealedOf(product);
}

function nameFor(product: Product | null, item: string, way: SheetWay = 'bottle'): string {
  const base = product ?? ({ name: item } as Product);
  return way === 'tot' ? totName(base) : way === 'stick' ? stickName(base) : way === 'pack' ? packName(base) : base.name;
}

/** When the sheet's night opened and closed, with the sales in between. */
function sheetTimes(sheet: StockSheet, now = Date.now()) {
  const outlet = identity.outlet();
  const window = businessDayWindow(sheet.businessDate, outlet.timezone, outlet.businessDayCutover);
  const openAt = window.start + MINUTE;
  const closeAt = Math.min(window.end - MINUTE, now - MINUTE);
  if (closeAt - openAt < 10 * MINUTE) throw new DomainError(`${sheet.title} is for a night that has not closed yet.`);
  return { openAt, salesAt: closeAt - MINUTE, closeAt, start: window.start, end: window.end };
}

function barLocation() {
  const all = inventory.locations().filter((l) => l.status === 'active');
  const bar = all.find((l) => l.isDefaultSale) ?? all.find((l) => l.kind === 'service') ?? all[0];
  if (!bar) throw new DomainError('Add a stock location first.');
  return bar;
}

const billIdFor = (sheet: StockSheet) => seedId(`stock-sheet:${sheet.id}:bill`);

/** Sheets whose night is over and that are not booked yet, for the Stock page to point at. */
export function sheetsToBook(now = Date.now()): { id: string; title: string; items: number }[] {
  const outlet = identity.outlet();
  return SHEETS.filter((s) => !settlement.billById(billIdFor(s)) && businessDayWindow(s.businessDate, outlet.timezone, outlet.businessDayCutover).start + 10 * MINUTE < now).map((s) => ({ id: s.id, title: s.title, items: s.counts.length }));
}

/** Stock units a sale line takes from the item it is counted as: a tot a share of the bottle. */
function stockTaken(sheet: StockSheet, product: Product | null, sale: StockSheet['sales'][number]): number {
  if (sale.way === 'tot') {
    const tot = product ? variantFor(product, 'tot') : null;
    if (tot) return round4(sale.qty * tot.depletionFactor);
    const bottle = product?.containerVolumeMl ?? sheet.menu.tots.find((t) => t.item === sale.item)?.bottleMl ?? sheet.menu.newProducts.find((p) => p.name === sale.item)?.bottleMl ?? 750;
    return round4((sale.qty * sheet.menu.totMl) / bottle);
  }
  if (sale.way === 'pack') return sale.qty * PACK;
  return sale.qty;
}

/* ----------------------------------------------------------------- the plan */

export interface SheetRow {
  item: string;
  note: string | null;
  section: string;
  productId: string | null;
  /** Added by the sheet, such as a new tequila. */
  isNew: boolean;
  unit: 'unit' | 'stick';
  opening: number;
  sold: number;
  closing: number;
  /** Closing less what the sales leave: below zero is stock missing. A tot's pour is not counted. */
  variance: number;
  onHandNow: number;
  onHandAfter: number;
  /** Sales Bliss already holds for this item during the sheet's night, which the sheet would double. */
  soldInBliss: number;
}

export interface SheetMenuChange {
  kind: 'product' | 'tot' | 'stick' | 'pack' | 'price' | 'bottle';
  label: string;
  detail: string;
  done: boolean;
}

export interface SheetPlan {
  id: string;
  title: string;
  businessDate: IsoDate;
  openAt: number;
  closeAt: number;
  applied: { at: number; by: string; billNumber: number } | null;
  rows: SheetRow[];
  sales: { item: string; label: string; qty: number; price: Cents; total: Cents }[];
  salesTotal: Cents;
  tenders: { kind: TenderKind; amount: Cents; reference: string }[];
  menu: SheetMenuChange[];
  missing: string[];
  totMl: number;
}

export function planSheet(sheet: StockSheet, now = Date.now()): SheetPlan {
  const times = sheetTimes(sheet, now);
  const newNames = new Set(sheet.menu.newProducts.map((p) => p.name.toLowerCase()));
  const sticks = new Set(sheet.menu.sticks.map((s) => s.item.toLowerCase()));
  const missing: string[] = [];

  const rows: SheetRow[] = sheet.counts.map((c) => {
    const product = productFor(c.item);
    const isNew = !product && newNames.has(c.item.toLowerCase());
    if (!product && !isNew) missing.push(c.item);
    const sealed = product ? sealedOf(product) : null;
    const lines = sheet.sales.filter((s) => s.item === c.item);
    const sold = round4(lines.reduce((n, s) => n + stockTaken(sheet, product, s), 0));
    const poured = lines.some((s) => s.way === 'tot');
    const expected = round4(c.opening - sold);
    const gap = round4(c.closing - expected);
    const variance = poured && Math.abs(gap) < 1 ? 0 : gap;
    const onHandNow = sealed ? inventory.onHand(sealed.id) : 0;
    const atClose = sealed ? inventory.onHand(sealed.id, null, times.closeAt) : 0;
    const closingTarget = variance === 0 ? expected : c.closing;
    const soldInBliss = sealed
      ? round4(inventory.movements({ variantId: sealed.id, type: 'sale', from: times.start, to: times.end }).filter((m) => m.sourceType !== 'stock_sheet').reduce((n, m) => n - m.qtyDelta, 0))
      : 0;
    return {
      item: c.item,
      note: c.note ?? null,
      section: product ? (catalogue.categoryById(product.categoryId)?.name ?? '') : (sheet.menu.newProducts.find((p) => p.name === c.item)?.category ?? ''),
      productId: product?.id ?? null,
      isNew,
      unit: sticks.has(c.item.toLowerCase()) ? 'stick' : 'unit',
      opening: c.opening,
      sold,
      closing: c.closing,
      variance,
      onHandNow,
      onHandAfter: round4(onHandNow - atClose + closingTarget),
      soldInBliss,
    };
  });

  const sales = sheet.sales.map((s) => {
    const product = productFor(s.item);
    const price = shillings(s.price);
    return { item: s.item, label: nameFor(product, s.item, s.way), qty: s.qty, price, total: multiplyByQty(price, s.qty) };
  });

  const bill = settlement.billById(billIdFor(sheet)) ?? null;
  const done = bill ? audit.list({ action: 'stock_sheet.applied' }).find((e) => e.entityId === sheet.id) : undefined;

  return {
    id: sheet.id,
    title: sheet.title,
    businessDate: sheet.businessDate,
    openAt: times.openAt,
    closeAt: times.closeAt,
    applied: bill ? { at: done?.occurredAt ?? bill.settledAt ?? 0, by: identity.displayName(done?.actorStaffId ?? bill.settledBy ?? ''), billNumber: bill.billNumber } : null,
    rows,
    sales,
    salesTotal: sum(sales.map((s) => s.total)),
    tenders: sheet.tenders.map((t) => ({ kind: t.kind, amount: shillings(t.amount), reference: t.reference })),
    menu: menuChanges(sheet),
    missing,
    totMl: sheet.menu.totMl,
  };
}

/** What the sheet changes on the menu, and whether each is already so. */
function menuChanges(sheet: StockSheet): SheetMenuChange[] {
  const out: SheetMenuChange[] = [];
  const priceOf = (v: ProductVariant | null) => (v ? (pricing.currentPrice(v.id)?.unitPriceCents ?? null) : null);
  for (const p of sheet.menu.newProducts) out.push({ kind: 'product', label: p.name, detail: `A new ${p.bottleMl}ml bottle in ${p.category}, kept in stock, priced for the tot`, done: Boolean(productFor(p.name)) });
  for (const t of sheet.menu.tots) {
    const product = productFor(t.item);
    const ml = product?.containerVolumeMl ?? t.bottleMl ?? null;
    if (product && !product.containerVolumeMl && t.bottleMl) out.push({ kind: 'bottle', label: product.name, detail: `Bottle size set to ${t.bottleMl}ml, so a tot takes its share`, done: false });
    const tot = product ? variantFor(product, 'tot') : null;
    const per = ml ? Math.floor(ml / sheet.menu.totMl) : null;
    out.push({ kind: 'tot', label: nameFor(product, t.item, 'tot'), detail: `${sheet.menu.totMl}ml${per ? `, ${per} to the bottle` : ''}, at ${formatKes(shillings(t.price), { decimals: 'whole' })}`, done: Boolean(tot && priceOf(tot) === shillings(t.price) && tot.serveVolumeMl === sheet.menu.totMl) });
  }
  for (const s of sheet.menu.sticks) {
    const product = productFor(s.item);
    const sealed = product ? sealedOf(product) : null;
    out.push({ kind: 'stick', label: nameFor(product, s.item, 'stick'), detail: `Counted and sold by the stick, at ${formatKes(shillings(s.stick), { decimals: 'whole' })}`, done: Boolean(product && sealed && sealed.name === stickName(product) && priceOf(sealed) === shillings(s.stick)) });
    const pack = product ? variantFor(product, 'pack') : null;
    out.push({ kind: 'pack', label: nameFor(product, s.item, 'pack'), detail: `Takes ${PACK} sticks, at ${formatKes(shillings(s.pack), { decimals: 'whole' })}`, done: Boolean(pack && priceOf(pack) === shillings(s.pack)) });
  }
  for (const p of sheet.menu.prices) {
    const product = productFor(p.item);
    out.push({ kind: 'price', label: p.item, detail: `Priced at ${formatKes(shillings(p.price), { decimals: 'whole' })}`, done: Boolean(product && priceOf(sealedOf(product)) === shillings(p.price)) });
  }
  return out;
}

/* ----------------------------------------------------------------- applying */

/** Bring the menu up to the sheet: new bottles, tots, cigarettes by the stick, prices. Safe to repeat. */
function applyMenu(sheet: StockSheet, actor: Actor, reason: string) {
  const base = pricingManage.defaultList();
  if (!base) throw new DomainError('The menu has no base price list to price the new ways of selling on.');
  const setPrice = (variant: ProductVariant, price: number) => {
    const cents = shillings(price);
    if (pricing.currentPrice(variant.id)?.unitPriceCents === cents) return;
    const listed = pricing.itemsFor(base.id).find((i) => i.productVariantId === variant.id && i.status === 'active');
    if (listed?.priceCents === cents) return;
    pricing.setPrice({ listId: base.id, variantId: variant.id, priceCents: cents, reason, actor });
  };

  for (const p of sheet.menu.newProducts) {
    if (productFor(p.name)) continue;
    const category = catalogue.categories().find((c) => c.name.toLowerCase() === p.category.toLowerCase() && c.status === 'active');
    if (!category) throw new DomainError(`${p.name} goes in ${p.category}, which is not on the menu.`);
    const section = MENU.find((s) => s.name === category.name);
    catalogueManage.createProduct(
      {
        categoryId: category.id,
        name: p.name,
        brand: null,
        sku: '',
        barcode: null,
        containerVolumeMl: p.bottleMl,
        abv: null,
        defaultSupplierId: null,
        imageKey: section?.key ? menuImage(section.key, p.name) : null,
        actor,
        firstVariant: { name: p.name, kind: 'sealed', serveVolumeMl: null, depletionFactor: 1 },
        basePriceCents: ZERO,
      },
      [],
      // The bottle is sold by the tot. Its own price waits for the owner, so it cannot go out at 0.
      () => undefined,
    );
  }

  for (const t of sheet.menu.tots) {
    const product = productFor(t.item);
    if (!product) throw new DomainError(`${t.item} is not on the menu, so its tot cannot be added.`);
    if (!product.containerVolumeMl && t.bottleMl) {
      catalogueManage.updateProduct({ ...product, containerVolumeMl: t.bottleMl, actor }, []);
    }
    const existing = variantFor(product, 'tot');
    const ml = product.containerVolumeMl ?? t.bottleMl;
    if (!ml) throw new DomainError(`${product.name} needs its bottle size before a tot can be poured from it.`);
    const tot = catalogueManage.saveVariant(
      { id: existing?.id ?? null, productId: product.id, name: totName(product), kind: 'serve', serveVolumeMl: sheet.menu.totMl, depletionFactor: sheet.menu.totMl / ml, barcode: null, isDefault: false, actor },
      existing ? undefined : (variantId) => pricing.setPrice({ listId: base.id, variantId, priceCents: shillings(t.price), reason, actor }),
    );
    setPrice(tot, t.price);
  }

  for (const s of sheet.menu.sticks) {
    const product = productFor(s.item);
    if (!product) throw new DomainError(`${s.item} is not on the menu.`);
    const sealed = sealedOf(product);
    if (!sealed) throw new DomainError(`${s.item} has no sealed way of selling to count sticks against.`);
    // The unit kept in stock becomes the stick; the pack is a way of selling that takes twenty.
    const stick = catalogueManage.saveVariant({ id: sealed.id, productId: product.id, name: stickName(product), kind: 'sealed', serveVolumeMl: null, depletionFactor: 1, barcode: sealed.barcode, isDefault: true, actor });
    setPrice(stick, s.stick);
    const existing = variantFor(product, 'pack');
    const pack = catalogueManage.saveVariant(
      { id: existing?.id ?? null, productId: product.id, name: packName(product), kind: 'serve', serveVolumeMl: null, depletionFactor: PACK, barcode: null, isDefault: false, actor },
      existing ? undefined : (variantId) => pricing.setPrice({ listId: base.id, variantId, priceCents: shillings(s.pack), reason, actor }),
    );
    setPrice(pack, s.pack);
  }

  for (const p of sheet.menu.prices) {
    const product = productFor(p.item);
    const sealed = product ? sealedOf(product) : null;
    if (!sealed) throw new DomainError(`${p.item} is not on the menu, so its price cannot be set.`);
    setPrice(sealed, p.price);
  }
}

export function applySheet(input: { sheetId: string; reason: string; actor: Actor; now?: number }): { billNumber: number; items: number } {
  const { actor } = input;
  identity.assertCan(actor.staffId, 'stock.count.commit', 'booking a stock sheet');
  identity.assertCan(actor.staffId, 'price.write', 'bringing the menu up to a stock sheet');
  const sheet = sheetById(input.sheetId);
  if (!sheet) throw new DomainError('That stock sheet is not here.');
  const billId = billIdFor(sheet);
  if (settlement.billById(billId)) throw new DomainError(`${sheet.title} is already booked.`);
  const reason = input.reason.trim() || `${sheet.title}, booked from the paper sheet`;
  const times = sheetTimes(sheet, input.now);
  const outlet = identity.outlet();

  // Every line must name something on the menu before anything is written.
  applyMenu(sheet, actor, reason);
  const resolved = sheet.counts.map((c) => {
    const product = productFor(c.item);
    const sealed = product ? sealedOf(product) : null;
    if (!product || !sealed) throw new DomainError(`${c.item} is not on the menu. Add it, or take it off the sheet, then book it again.`);
    return { count: c, product, sealed };
  });
  const sales = sheet.sales.map((s) => {
    const product = productFor(s.item);
    const variant = product ? variantFor(product, s.way) : null;
    if (!product || !variant) throw new DomainError(`${s.item} (${s.way ?? 'bottle'}) is not on the menu.`);
    return { sale: s, product, variant };
  });

  const bar = barLocation();
  const locations = inventory.locations();
  const move = (variantId: string, locationId: string, qtyDelta: number, at: number, why: string, confirm = false) => {
    if (round4(qtyDelta) === 0 && !confirm) return;
    inventory.recordMovement({ variantId, locationId, qtyDelta: round4(qtyDelta), type: 'count_adjustment', sourceType: 'stock_sheet', sourceId: sheet.id, reason: why, actor, at });
  };

  // 1. The opening count, at the bar and nothing anywhere else. An item never counted before is
  //    recorded even when the count agrees, so a blank line reads as counted at 0, not "Not counted".
  for (const { count, sealed } of resolved) {
    const firstCount = !inventory.stockRecorded(sealed.id);
    for (const l of locations) {
      const want = l.id === bar.id ? count.opening : 0;
      move(sealed.id, l.id, want - inventory.onHand(sealed.id, l.id, times.openAt), times.openAt, `Opening count, ${sheet.title.toLowerCase()}: ${reason}`, firstCount && l.id === bar.id);
    }
  }

  // 2. The night's sales, as one settled bill on that day.
  const bill = settlementCommands.recordBookedBill({
    billId,
    businessDate: sheet.businessDate,
    settledAt: times.salesAt,
    lines: sales.map(({ sale, variant }) => ({ productVariantId: variant.id, description: variant.name, qty: sale.qty, unitPriceCents: shillings(sale.price) })),
    tenders: sheet.tenders.map((x, i) => ({ id: seedId(`stock-sheet:${sheet.id}:tender:${i}`), kind: x.kind, amountCents: shillings(x.amount), reference: x.reference })),
    actor,
  });

  // Reports start at the outlet's first business day. A sheet from before it is trade on an earlier
  // day, so the outlet's record now starts there, and the night shows in Sales and Bills.
  const data = dataset();
  if (sheet.businessDate < data.firstBusinessDate) data.firstBusinessDate = sheet.businessDate;

  // 3. The closing count. What the sales left is what the shelf should hold; any gap is a variance.
  let variances = 0;
  for (const { count, sealed } of resolved) {
    const poured = sheet.sales.some((s) => s.item === count.item && s.way === 'tot');
    const held = inventory.onHand(sealed.id, null, times.closeAt);
    const gap = round4(count.closing - held);
    if (gap === 0 || (poured && Math.abs(gap) < 1)) continue;
    variances += 1;
    move(sealed.id, bar.id, gap, times.closeAt, `Closing count, ${sheet.title.toLowerCase()}: ${gap < 0 ? `${-gap} fewer than the sales leave` : `${gap} more than the sales leave`}`);
  }

  audit.record({
    outletId: outlet.id,
    actorStaffId: actor.staffId,
    actorDeviceId: actor.deviceId ?? null,
    action: 'stock_sheet.applied',
    entityType: 'stock_sheet',
    entityId: sheet.id,
    before: null,
    after: { title: sheet.title, businessDate: sheet.businessDate, items: resolved.length, billNumber: bill.billNumber, salesCents: bill.totalCents.toString(), variances },
    reason,
    severity: 'sensitive',
  });
  return { billNumber: bill.billNumber, items: resolved.length };
}
