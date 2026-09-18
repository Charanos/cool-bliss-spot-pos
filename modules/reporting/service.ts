import 'server-only';

import type { OrderLine } from '@bliss/shared/domain';
import { type Cents, ZERO, abs, add, compare, formatKes, isNegative, isPositive, multiplyByQuantity, percentChangeBps, scale, shareBps, subtract, sum } from '@bliss/shared/money';
import { type IsoDate, addDays, weekdayOf, zonedParts } from '@bliss/shared/time';
import { formatIsoDate, formatTime, formatWeekday, plural } from '@bliss/shared/format';
import { dataset } from '../_data/source';
import * as availability from '../availability/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as procurement from '../procurement/service';
import * as settlement from '../settlement/service';
import * as sync from '../sync/service';
import * as trade from '../trade/service';

/**
 * Reporting composes the other modules' services. It owns no tables of its own here; in Phase 7 it
 * gains materialised rollups. Money stays Cents to the edge, and ratios are basis points.
 */

export function clock() {
  const d = dataset();
  return { now: d.now, lastNight: d.lastNight, current: d.currentBusinessDate, first: d.firstBusinessDate, tradingInProgress: d.tradingInProgress };
}

function exVat(amount: Cents): Cents {
  const outlet = identity.outlet();
  if (!outlet.pricesTaxInclusive) return amount;
  return scale(amount, 10_000n, BigInt(10_000 + outlet.taxRateBps));
}

/** Cost of goods for lines, from the sale movements they wrote, at the cost stored on each movement. */
function costOfLines(lines: readonly OrderLine[]): Cents {
  const ids = new Set(lines.map((l) => l.id));
  let total = ZERO;
  for (const m of inventory.movements({ type: 'sale' })) {
    if (m.sourceId && ids.has(m.sourceId)) total = add(total, multiplyByQuantity(m.unitCostCents, -m.qtyDelta));
  }
  return total;
}

function linesOn(date: IsoDate) {
  return trade.linesBetween(date, date);
}

export interface Headline {
  netSales: Cents;
  salesDeltaBps: number | null;
  comparedWith: string;
  grossMarginBps: number;
  seatsServed: number;
  tabs: number;
  avgSeats: number;
  varianceAtCost: Cents;
  varianceLines: number;
}

export function headline(date: IsoDate): Headline {
  const netSales = settlement.netSales(date);
  const previous = [7, 14, 21, 28].map((n) => settlement.netSales(addDays(date, -n))).filter((c) => isPositive(c));
  const baseline = previous.length > 0 ? scale(sum(previous), 1n, BigInt(previous.length)) : null;
  const lines = linesOn(date);
  const revenue = exVat(sum(lines.map((l) => l.lineTotalCents)));
  const cost = costOfLines(lines);
  const tabs = trade.tabsOn(date).filter((t) => trade.linesFor(t.id).some((l) => l.status !== 'voided')).length;
  const seatsServed = trade.seatsServed(date);
  const variance = latestCommittedVariance();
  return {
    netSales,
    salesDeltaBps: baseline ? percentChangeBps(baseline, netSales) : null,
    comparedWith: `${formatWeekday(date).slice(0, 3)} avg`,
    grossMarginBps: shareBps(subtract(revenue, cost), revenue),
    seatsServed,
    tabs,
    avgSeats: tabs > 0 ? seatsServed / tabs : 0,
    varianceAtCost: variance?.total ?? ZERO,
    varianceLines: variance?.outside ?? 0,
  };
}

export function salesByHour(date: IsoDate) {
  const tz = identity.outlet().timezone;
  const hours = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
  const buckets = new Map<number, Cents>(hours.map((h) => [h, ZERO]));
  for (const line of linesOn(date)) {
    const firedAt = trade.orderFiredAt(line.orderId);
    if (!firedAt) continue;
    const hour = zonedParts(firedAt, tz).hour;
    if (!buckets.has(hour)) continue;
    buckets.set(hour, add(buckets.get(hour)!, line.lineTotalCents));
  }
  return hours.map((h) => ({ hour: `${String(h).padStart(2, '0')}:00`, value: buckets.get(h)! }));
}

export function latestCommittedVariance() {
  const committed = inventory.counts().find((c) => c.status === 'committed');
  if (!committed) return null;
  const view = inventory.countLines(committed.id);
  if (view.stage !== 'review') return null;
  const rows = view.lines
    .filter((l) => l.varianceQty !== null && l.varianceQty !== 0)
    .map((l) => ({
      variantId: l.productVariantId,
      name: catalogue.productOfVariant(l.productVariantId)?.name ?? '',
      expected: l.expectedQty,
      counted: l.countedQty ?? 0,
      variance: l.varianceQty ?? 0,
      value: l.varianceCents ?? ZERO,
      outside: l.outsideTolerance,
    }))
    .sort((a, b) => compare(abs(b.value), abs(a.value)));
  return {
    count: committed,
    rows,
    total: sum(rows.map((r) => r.value)),
    outside: rows.filter((r) => r.outside).length,
  };
}

export interface MoverRow {
  productId: string;
  name: string;
  units: number;
  value: Cents;
  marginBps: number;
}

export function topMovers(from: IsoDate, to: IsoDate, limit = 6): MoverRow[] {
  const lines = trade.linesBetween(from, to);
  const byProduct = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const product = catalogue.productOfVariant(l.productVariantId);
    if (!product) continue;
    byProduct.set(product.id, [...(byProduct.get(product.id) ?? []), l]);
  }
  return [...byProduct.entries()]
    .map(([productId, own]) => {
      const value = sum(own.map((l) => l.lineTotalCents));
      const revenue = exVat(value);
      return {
        productId,
        name: catalogue.productById(productId)?.name ?? '',
        units: own.reduce((a, l) => a + l.qty, 0),
        value,
        marginBps: shareBps(subtract(revenue, costOfLines(own)), revenue),
      };
    })
    .sort((a, b) => compare(b.value, a.value))
    .slice(0, limit);
}

export interface AttentionItem {
  tone: 'stop' | 'low' | 'info';
  text: string;
  href: string;
  cta: string;
}

/** At most five exceptions, most urgent first. None means nothing needs the owner today. */
export function needsAttention(): AttentionItem[] {
  const items: (AttentionItem & { rank: number })[] = [];
  const outlet = identity.outlet();
  const { lastNight } = clock();

  const deadLetters = sync.deadLetters({ resolved: false });
  if (deadLetters.length > 0) {
    const device = identity.devices().find((d) => d.id === deadLetters[0]!.deviceId);
    items.push({ rank: 0, tone: 'stop', text: `${plural(deadLetters.length, 'order')} from ${device?.label ?? 'a tablet'} could not be sent`, href: '/console/settings/sync', cta: 'See why' });
  }

  const drawer = settlement.drawerFor(lastNight);
  if (drawer?.stage === 'closed' && drawer.varianceCents && compare(abs(drawer.varianceCents), outlet.drawerVarianceThresholdCents) > 0) {
    const under = isNegative(drawer.varianceCents);
    items.push({
      rank: 1,
      tone: 'low',
      text: `Drawer closed ${formatKes(abs(drawer.varianceCents), { decimals: 'whole' })} ${under ? 'under' : 'over'} at ${drawer.closedAt ? formatTime(drawer.closedAt, outlet.timezone) : 'close'}`,
      href: '/console/trade/drawers',
      cta: 'Read the reason',
    });
  }

  for (const hold of inventory.activeHolds()) {
    const name = catalogue.productOfVariant(hold.productVariantId)?.name ?? 'An item';
    items.push({ rank: 2, tone: 'low', text: `${name} has been on hold since ${formatWeekday(isoOf(hold.placedAt))}`, href: '/console/inventory/holds', cta: 'Review hold' });
  }

  const finished = availability
    .map()
    .entries.filter((e) => e.state === 'finished' && e.reason === 'stock' && catalogue.variantById(e.productVariantId)?.isDefault);
  if (finished.length > 0) {
    const names = finished.map((e) => catalogue.productOfVariant(e.productVariantId)?.name ?? '').slice(0, 2);
    items.push({ rank: 3, tone: 'stop', text: `${names.join(' and ')} ${finished.length === 1 ? 'is' : 'are'} finished on the floor`, href: '/console/purchasing/reorder', cta: 'Reorder' });
  }

  const reorder = procurement.reorderSuggestions().length;
  if (reorder > 0) items.push({ rank: 4, tone: 'info', text: `${plural(reorder, 'line')} below reorder point`, href: '/console/purchasing/reorder', cta: 'See suggestions' });

  const variance = latestCommittedVariance();
  const worst = variance?.rows.find((r) => r.outside && isNegative(r.value));
  if (worst) {
    items.push({ rank: 5, tone: 'low', text: `${worst.name} counted ${Math.abs(worst.variance).toFixed(1)} bottles short, ${formatKes(abs(worst.value), { decimals: 'whole' })} at cost`, href: '/console/reports/pour-variance', cta: 'See variance' });
  }

  return items.sort((a, b) => a.rank - b.rank).slice(0, 5);
}

function isoOf(at: number): IsoDate {
  const p = zonedParts(at, identity.outlet().timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ pour variance */

export interface PourVarianceRow {
  variantId: string;
  name: string;
  theoreticalUnits: number;
  actualUnits: number;
  varianceUnits: number;
  varianceMl: number;
  varianceCents: Cents;
  variancePct: number;
  tolerancePct: number;
  outside: boolean;
}

/**
 * docs/04-data-model.md, "Pour variance for a period", between the last two committed counts of the
 * bar shelf: actual = opening counted + received - closing counted, theoretical = sold serves.
 */
export function pourVariance(): { from: number | null; to: number | null; rows: PourVarianceRow[] } {
  const bar = inventory.locations().find((l) => l.kind === 'service');
  const committed = inventory
    .counts()
    .filter((c) => c.status === 'committed' && c.stockLocationId === bar?.id && c.kind === 'full')
    .sort((a, b) => (b.committedAt ?? 0) - (a.committedAt ?? 0));
  const closing = committed[0];
  const opening = committed[1];
  if (!closing || !opening || !bar) return { from: null, to: null, rows: [] };

  const openView = inventory.countLines(opening.id);
  const closeView = inventory.countLines(closing.id);
  if (openView.stage !== 'review' || closeView.stage !== 'review') return { from: null, to: null, rows: [] };

  const from = opening.committedAt ?? opening.openedAt;
  const to = closing.openedAt;
  const rows: PourVarianceRow[] = [];
  for (const variant of catalogue.stockVariants()) {
    const product = catalogue.productOfVariant(variant.id);
    const category = catalogue.categoryOfVariant(variant.id);
    if (!product?.containerVolumeMl || !(category?.name === 'Spirits' || category?.name === 'Wine')) continue;
    const openLine = openView.lines.find((l) => l.productVariantId === variant.id);
    const closeLine = closeView.lines.find((l) => l.productVariantId === variant.id);
    if (!openLine || !closeLine || openLine.countedQty === null || closeLine.countedQty === null) continue;
    const window = inventory.movements({ variantId: variant.id, locationId: bar.id, from, to });
    const received = window.filter((m) => m.movementType === 'transfer_in' || m.movementType === 'receipt').reduce((a, m) => a + m.qtyDelta, 0);
    const otherOut = window.filter((m) => m.movementType.startsWith('write_off') || m.movementType === 'transfer_out').reduce((a, m) => a - m.qtyDelta, 0);
    const theoretical = window.filter((m) => m.movementType === 'sale').reduce((a, m) => a - m.qtyDelta, 0);
    const actual = openLine.countedQty + received - otherOut - closeLine.countedQty;
    const varianceUnits = Math.round((actual - theoretical) * 1000) / 1000;
    const tolerancePct = category.name === 'Spirits' ? 2 : 1.5;
    const pct = theoretical > 0 ? (varianceUnits / theoretical) * 100 : 0;
    rows.push({
      variantId: variant.id,
      name: product.name,
      theoreticalUnits: theoretical,
      actualUnits: actual,
      varianceUnits,
      varianceMl: Math.round(varianceUnits * product.containerVolumeMl),
      varianceCents: multiplyByQuantity(inventory.averageCost(variant.id), varianceUnits),
      variancePct: pct,
      tolerancePct,
      outside: Math.abs(pct) > tolerancePct,
    });
  }
  rows.sort((a, b) => compare(abs(b.varianceCents), abs(a.varianceCents)));
  return { from, to, rows };
}

/* -------------------------------------------------------- voids and discounts */

export function voidsByStaff(from: IsoDate, to: IsoDate) {
  const lines = trade.linesBetween(from, to, { includeVoided: true });
  const shifts = trade.shiftsBetween(from, to);
  const staffIds = [...new Set(shifts.map((s) => s.staffId))];
  return staffIds
    .map((staffId) => {
      const own = lines.filter((l) => l.createdBy === staffId);
      const voided = own.filter((l) => l.status === 'voided');
      const sold = sum(own.filter((l) => l.status !== 'voided').map((l) => l.lineTotalCents));
      const voidValue = sum(voided.map((l) => l.lineTotalCents));
      return {
        staffId,
        name: identity.displayName(staffId),
        lines: own.length,
        voids: voided.length,
        voidValue,
        sales: sold,
        voidRateBps: shareBps(voidValue, add(sold, voidValue)),
        discounts: sum(shifts.filter((s) => s.staffId === staffId).map((s) => s.discountsCents)),
        reasons: voided.slice(0, 4).map((l) => ({ reason: l.voidReason ?? '', at: l.voidedAt ?? 0 })),
      };
    })
    .sort((a, b) => b.voidRateBps - a.voidRateBps);
}

/* ------------------------------------------------------------ seat position */

/** N-14: sales by seat position, to understand table composition. */
export function seatComposition(from: IsoDate, to: IsoDate) {
  const tabs = trade.tabsBetween(from, to).filter((t) => t.status !== 'voided');
  const byGuests = new Map<number, { tabs: number; total: Cents }>();
  const bySeat = new Map<string, { total: Cents; lines: number }>();
  let shared = ZERO;
  let all = ZERO;
  for (const tab of tabs) {
    const lines = trade.linesFor(tab.id).filter((l) => l.status !== 'voided');
    if (lines.length === 0) continue;
    const seats = trade.seatsFor(tab.id);
    const total = sum(lines.map((l) => l.lineTotalCents));
    all = add(all, total);
    const g = byGuests.get(tab.guestCount) ?? { tabs: 0, total: ZERO };
    byGuests.set(tab.guestCount, { tabs: g.tabs + 1, total: add(g.total, total) });
    for (const l of lines) {
      if (l.tabSeatId === null) {
        shared = add(shared, l.lineTotalCents);
        continue;
      }
      const seatNo = seats.find((s) => s.id === l.tabSeatId)?.seatNo ?? 0;
      const k = seatNo >= 5 ? '5+' : String(seatNo);
      const cur = bySeat.get(k) ?? { total: ZERO, lines: 0 };
      bySeat.set(k, { total: add(cur.total, l.lineTotalCents), lines: cur.lines + 1 });
    }
  }
  const guests = [...byGuests.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([guestCount, v]) => ({ guestCount, tabs: v.tabs, total: v.total, perSeat: scale(v.total, 1n, BigInt(Math.max(1, guestCount * v.tabs))) }));
  const seats = ['1', '2', '3', '4', '5+'].map((k) => ({ seat: k, total: bySeat.get(k)?.total ?? ZERO, lines: bySeat.get(k)?.lines ?? 0, shareBps: shareBps(bySeat.get(k)?.total ?? ZERO, all) }));
  const withSeats = tabs.filter((t) => t.guestCount >= 2);
  const attributed = trade.linesBetween(from, to).filter((l) => withSeats.some((t) => t.id === l.tabId));
  const attributionBps = attributed.length > 0 ? Math.round((attributed.filter((l) => l.tabSeatId !== null).length / attributed.length) * 10_000) : 0;
  return { guests, seats, shared, sharedShareBps: shareBps(shared, all), attributionBps, total: all };
}

/* ---------------------------------------------------------------- dead stock */

export function deadStock(days = 60) {
  const now = clock().now;
  return catalogue
    .stockVariants()
    .map((v) => {
      const last = inventory.lastMovementAt(v.id, ['sale']);
      const onHand = inventory.onHand(v.id);
      return { variantId: v.id, name: v.name, lastSaleAt: last, onHand, value: inventory.valueAtCost(v.id, onHand), idleDays: last ? Math.floor((now - last) / 86_400_000) : null };
    })
    .filter((r) => r.onHand > 0 && (r.idleDays === null || r.idleDays >= days))
    .sort((a, b) => compare(b.value, a.value));
}

/* --------------------------------------------------------------------- sales */

export function salesByDay(from: IsoDate, to: IsoDate) {
  const out: { date: IsoDate; label: string; value: Cents; tabs: number; weekday: number }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push({ date: d, label: formatIsoDate(d), value: settlement.netSales(d), tabs: trade.tabsOn(d).length, weekday: weekdayOf(d) });
  }
  return out;
}

export function salesByCategory(from: IsoDate, to: IsoDate) {
  const lines = trade.linesBetween(from, to);
  const byCat = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const cat = catalogue.categoryOfVariant(l.productVariantId);
    if (cat) byCat.set(cat.id, [...(byCat.get(cat.id) ?? []), l]);
  }
  const total = sum(lines.map((l) => l.lineTotalCents));
  return catalogue.categories().map((c) => {
    const own = byCat.get(c.id) ?? [];
    const value = sum(own.map((l) => l.lineTotalCents));
    const revenue = exVat(value);
    return {
      categoryId: c.id,
      name: c.name,
      colour: c.colourToken,
      units: own.reduce((a, l) => a + l.qty, 0),
      value,
      shareBps: shareBps(value, total),
      marginBps: shareBps(subtract(revenue, costOfLines(own)), revenue),
    };
  });
}

/* ------------------------------------------------------------- sales summary */

export interface SalesSummary {
  netSales: Cents;
  deltaBps: number | null;
  bills: number;
  averageBill: Cents;
  grossMarginBps: number;
  discounts: Cents;
  voids: Cents;
  voidLines: number;
}

/** A range of business days against the same number of days immediately before it. */
export function salesSummary(from: IsoDate, to: IsoDate, previous: { from: IsoDate; to: IsoDate }): SalesSummary {
  const settled = (a: IsoDate, b: IsoDate) => settlement.billsBetween(a, b).filter((bill) => bill.status !== 'open');
  const bills = settled(from, to);
  const netSales = sum(bills.map((b) => b.totalCents));
  const before = sum(settled(previous.from, previous.to).map((b) => b.totalCents));
  const lines = trade.linesBetween(from, to);
  const revenue = exVat(sum(lines.map((l) => l.lineTotalCents)));
  const voided = trade.voidedBetween(from, to);
  return {
    netSales,
    deltaBps: isPositive(before) ? percentChangeBps(before, netSales) : null,
    bills: bills.length,
    averageBill: bills.length > 0 ? scale(netSales, 1n, BigInt(bills.length)) : ZERO,
    grossMarginBps: shareBps(subtract(revenue, costOfLines(lines)), revenue),
    discounts: sum(bills.map((b) => b.discountCents)),
    voids: sum(voided.map((l) => l.lineTotalCents)),
    voidLines: voided.length,
  };
}
