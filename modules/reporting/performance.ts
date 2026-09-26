import 'server-only';

import type { CategoryColourToken, OrderLine } from '@bliss/shared/domain';
import { type Cents, ZERO, abs, compare, isPositive, percentChangeBps, scale, shareBps, subtract, sum } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as settlement from '../settlement/service';
import * as trade from '../trade/service';
import { clock, costOfLines, exVat, lineCosts } from './service';

/**
 * Performance for a range of business days, built only from what Bliss records: settled bills,
 * fired lines, the cost on each sale movement, tenders, drawer payouts, shifts and committed counts.
 *
 * What Bliss does not record is not estimated. There are no rent, power or wage figures, no tax
 * filing, no fiscal queue (KRA eTIMS is out of scope, docs/00): the page says so rather than showing
 * a number someone made up. Money is Cents throughout; ratios are basis points.
 */

export interface CategoryPerformance {
  id: string;
  name: string;
  colour: CategoryColourToken;
  units: number;
  /** Sold, VAT included, as rung up. */
  sales: Cents;
  revenueExVat: Cents;
  cost: Cents;
  /** Sales with no recorded cost: food, or a category that does not track stock. */
  uncosted: Cents;
  marginBps: number;
  /** Cost as a share of revenue ex VAT, on the costed sales only: the bar's pour cost. */
  costBps: number | null;
}

export interface ItemPerformance {
  variantId: string;
  name: string;
  category: string;
  units: number;
  sales: Cents;
  contribution: Cents | null;
  marginBps: number | null;
}

export interface PerformanceReport {
  from: IsoDate;
  to: IsoDate;
  sales: {
    /** Every fired line not voided, VAT included. */
    rungUp: Cents;
    voids: Cents;
    voidLines: number;
    discounts: Cents;
    /** Settled as a comp: given away, recorded as a tender. */
    comps: Cents;
    /** What settled bills came to. */
    settled: Cents;
    vat: Cents;
    bills: number;
    averageBill: Cents;
    deltaBps: number | null;
  };
  margin: {
    revenueExVat: Cents;
    cost: Cents;
    grossProfit: Cents;
    marginBps: number;
    uncosted: Cents;
  };
  categories: CategoryPerformance[];
  tenders: { kind: string; amount: Cents; count: number }[];
  payouts: { total: Cents; rows: { id: string; at: number; amount: Cents; reason: string | null; by: string }[] };
  variance: { counts: number; total: Cents; lines: { name: string; qty: number; value: Cents }[] } | null;
  labour: { shifts: number; people: number; hours: number; salesPerHour: Cents | null };
  items: { bestSeller: ItemPerformance | null; mostProfit: ItemPerformance | null; slowest: ItemPerformance | null; lowestMargin: ItemPerformance | null };
  openNow: { tabs: number; value: Cents; fromEarlierDays: number };
}

export function performance(from: IsoDate, to: IsoDate, previous: { from: IsoDate; to: IsoDate }): PerformanceReport {
  const bills = settlement.billsBetween(from, to).filter((b) => b.status !== 'open');
  const billIds = new Set(bills.map((b) => b.id));
  const tenders = settlement.readTables().tenders.filter((t) => billIds.has(t.billId));
  const settled = sum(bills.map(settlement.billNet));
  const before = sum(settlement.billsBetween(previous.from, previous.to).filter((b) => b.status !== 'open').map(settlement.billNet));

  const lines = trade.linesBetween(from, to);
  const voided = trade.voidedBetween(from, to);
  const costs = lineCosts(lines);
  const rungUp = sum(lines.map((l) => l.lineTotalCents));
  const revenueExVat = exVat(rungUp);
  const cost = costOfLines(lines);
  const uncosted = sum(lines.filter((l) => !costs.has(l.id)).map((l) => l.lineTotalCents));

  // By category.
  const byCategory = new Map<string, OrderLine[]>();
  for (const l of lines) {
    const category = catalogue.categoryOfVariant(l.productVariantId);
    if (category) byCategory.set(category.id, [...(byCategory.get(category.id) ?? []), l]);
  }
  const categories: CategoryPerformance[] = catalogue
    .categories()
    .map((c) => {
      const own = byCategory.get(c.id) ?? [];
      const costed = own.filter((l) => costs.has(l.id));
      const sales = sum(own.map((l) => l.lineTotalCents));
      const ownRevenue = exVat(sales);
      const ownCost = sum(costed.map((l) => costs.get(l.id)!));
      const costedRevenue = exVat(sum(costed.map((l) => l.lineTotalCents)));
      return {
        id: c.id,
        name: c.name,
        colour: c.colourToken,
        units: own.reduce((n, l) => n + l.qty, 0),
        sales,
        revenueExVat: ownRevenue,
        cost: ownCost,
        uncosted: sum(own.filter((l) => !costs.has(l.id)).map((l) => l.lineTotalCents)),
        marginBps: shareBps(subtract(ownRevenue, ownCost), ownRevenue),
        costBps: isPositive(costedRevenue) ? shareBps(ownCost, costedRevenue) : null,
      };
    })
    .filter((c) => isPositive(c.sales))
    .sort((a, b) => compare(b.sales, a.sales));

  // By item.
  const byItem = new Map<string, OrderLine[]>();
  for (const l of lines) byItem.set(l.productVariantId, [...(byItem.get(l.productVariantId) ?? []), l]);
  const items: ItemPerformance[] = [...byItem.entries()].map(([variantId, own]) => {
    const sales = sum(own.map((l) => l.lineTotalCents));
    const costed = own.every((l) => costs.has(l.id));
    const revenue = exVat(sales);
    const itemCost = sum(own.map((l) => costs.get(l.id) ?? ZERO));
    return {
      variantId,
      name: catalogue.variantById(variantId)?.name ?? 'Item no longer on the menu',
      category: catalogue.categoryOfVariant(variantId)?.name ?? '',
      units: own.reduce((n, l) => n + l.qty, 0),
      sales,
      contribution: costed ? subtract(revenue, itemCost) : null,
      marginBps: costed ? shareBps(subtract(revenue, itemCost), revenue) : null,
    };
  });
  const costedItems = items.filter((i) => i.contribution !== null);

  // Drawer payouts in the range: cash that left the drawer, with its reason.
  const sessions = new Set(settlement.drawerSessionsBetween(from, to).map((s) => s.id));
  const payouts = settlement
    .readTables()
    .cashMovements.filter((m) => m.kind === 'payout' && sessions.has(m.drawerSessionId))
    .map((m) => ({ id: m.id, at: m.occurredAt, amount: abs(m.amountCents), reason: m.reason, by: identity.displayName(m.createdBy) }))
    .sort((a, b) => b.at - a.at);

  // Counts committed for business days in the range, named line by line.
  const counts = inventory.counts().filter((c) => c.status === 'committed' && c.businessDate >= from && c.businessDate <= to);
  const varianceLines = counts.flatMap((c) => {
    const view = inventory.countLines(c.id);
    return view.stage === 'review' ? view.lines.filter((l) => l.varianceCents !== null && l.varianceQty !== null && l.varianceQty !== 0) : [];
  });

  const shifts = trade.shiftsBetween(from, to);
  const hours = shifts.reduce((n, s) => n + Math.max(0, ((s.endedAt ?? Date.now()) - s.startedAt) / 3_600_000), 0);
  const open = trade.openTabs();
  const today = clock().current;

  return {
    from,
    to,
    sales: {
      rungUp,
      voids: sum(voided.map((l) => l.lineTotalCents)),
      voidLines: voided.length,
      discounts: sum(bills.map((b) => b.discountCents)),
      comps: sum(tenders.filter((t) => t.kind === 'comp').map((t) => t.amountCents)),
      settled,
      vat: sum(bills.map((b) => b.taxCents)),
      bills: bills.length,
      averageBill: bills.length > 0 ? scale(settled, 1n, BigInt(bills.length)) : ZERO,
      deltaBps: isPositive(before) ? percentChangeBps(before, settled) : null,
    },
    margin: { revenueExVat, cost, grossProfit: subtract(revenueExVat, cost), marginBps: shareBps(subtract(revenueExVat, cost), revenueExVat), uncosted },
    categories,
    tenders: settlement.tenderMix(from, to),
    payouts: { total: sum(payouts.map((p) => p.amount)), rows: payouts },
    variance:
      counts.length > 0
        ? {
            counts: counts.length,
            total: sum(varianceLines.map((l) => l.varianceCents!)),
            lines: varianceLines
              .map((l) => ({ name: catalogue.variantById(l.productVariantId)?.name ?? 'Item no longer stocked', qty: l.varianceQty!, value: l.varianceCents! }))
              .sort((a, b) => compare(abs(b.value), abs(a.value)))
              .slice(0, 6),
          }
        : null,
    labour: {
      shifts: shifts.length,
      people: new Set(shifts.map((s) => s.staffId)).size,
      hours: Math.round(hours * 10) / 10,
      salesPerHour: hours >= 1 ? scale(settled, 10n, BigInt(Math.round(hours * 10))) : null,
    },
    items: {
      bestSeller: [...items].sort((a, b) => b.units - a.units)[0] ?? null,
      mostProfit: [...costedItems].sort((a, b) => compare(b.contribution!, a.contribution!))[0] ?? null,
      slowest: [...items].sort((a, b) => a.units - b.units)[0] ?? null,
      lowestMargin: [...costedItems].sort((a, b) => a.marginBps! - b.marginBps!)[0] ?? null,
    },
    openNow: { tabs: open.length, value: sum(open.map((t) => t.total)), fromEarlierDays: open.filter((t) => t.tab.businessDate < today).length },
  };
}

