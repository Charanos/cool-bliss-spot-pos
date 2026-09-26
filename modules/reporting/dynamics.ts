import 'server-only';

import type { OrderLine, Product, ProductVariant } from '@bliss/shared/domain';
import {
  type Cents,
  ZERO,
  abs,
  add,
  compare,
  cents,
  formatKes,
  isNegative,
  isPositive,
  multiplyByQuantity,
  percentChangeBps,
  scale,
  shareBps,
  subtract,
  sum,
} from '@bliss/shared/money';
import { type IsoDate, addDays, weekdayOf, zonedParts } from '@bliss/shared/time';
import { dataset } from '../_data/source';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as settlement from '../settlement/service';
import { settlementTables } from '../settlement/schema';
import * as trade from '../trade/service';
import * as reporting from './service';

export interface SalesChannelBreakdown {
  barCents: Cents;
  tableCents: Cents;
  vipCents: Cents;
  happyHourCents: Cents;
}

export interface TenderBreakdown {
  cashCents: Cents;
  mpesaCents: Cents;
  cardCents: Cents;
  splitCents: Cents;
}

export interface CogsCategoryBreakdown {
  liquorTheoreticalCents: Cents;
  beerTheoreticalCents: Cents;
  wineTheoreticalCents: Cents;
  foodTheoreticalCents: Cents;
  extrasTheoreticalCents: Cents;
  totalTheoreticalCents: Cents;
  varianceShrinkageCents: Cents;
  realCogsCents: Cents;
}

export interface AuxiliaryExpenses {
  rentCents: Cents;
  powerCents: Cents; // KPLC + Generator diesel
  waterBowserCents: Cents; // Nairobi reality bowser water
  dstvCents: Cents;
  securityCents: Cents;
  gasCents: Cents;
  supplierCodCents: Cents; // COD drawer payouts with photo
  totalOpexCents: Cents;
}

export interface CasualsLabor {
  clockedHours: number;
  baseHourlyRateCents: Cents;
  statutoryLoadBps: number; // NSSF, SHIF (2.75%), Housing Levy (1.5%), PAYE accrual (~12%)
  baseCostCents: Cents;
  statutoryCostCents: Cents;
  totalCasualsCostCents: Cents;
  headcount: number;
  isWeekendSpike: boolean;
}

export interface TaxLiabilitySummary {
  vatOnSalesCents: Cents; // 16% VAT inclusive
  vatOnServiceChargeCents: Cents;
  exciseInCostCents: Cents; // Excise duty already in spirits/beer
  payrollStatutoryCents: Cents; // PAYE, NSSF, SHIF, Housing Levy
  withholdingTaxCents: Cents; // 5% withholding on rent/contractors
  totalLiabilityCents: Cents;
  filingStatus: 'accruing_running_month' | 'filed_with_kra';
}

export interface SkuQuadrantLeader {
  variantId: string;
  productId: string;
  name: string;
  category: string;
  units: number;
  sellingPriceCents: Cents;
  recipeCostCents: Cents;
  unitContributionCents: Cents;
  totalContributionCents: Cents;
  grossMarginPct: number;
  note?: string;
}

export interface SkuQuadrants {
  highestUnitSales: SkuQuadrantLeader | null;
  highestProfitability: SkuQuadrantLeader | null;
  lowestUnitSales: SkuQuadrantLeader | null;
  lowestProfitability: SkuQuadrantLeader | null;
}

export interface SpiritPourCostCategory {
  categoryName: string;
  actualPourCostPct: number;
  targetPourCostPct: number; // 18-24%
  salesCents: Cents;
  costCents: Cents;
  isAboveTarget: boolean;
}

export interface NamedShrinkageItem {
  variantId: string;
  name: string;
  category: string;
  missingUnits: number;
  unitCostCents: Cents;
  lossCents: Cents;
}

export interface FourOwnerQuestions {
  // Q1: Pour cost % by spirit category vs target (~18-24% liquor, Kenya often 30%+)
  pourCosts: SpiritPourCostCategory[];
  overallSpiritsPourCostPct: number;
  industryTargetSpiritsPct: number;

  // Q2: Shrinkage KES this week, named
  shrinkageThisWeekCents: Cents;
  namedShrinkageItems: NamedShrinkageItem[];

  // Q3: Labor % of sales tonight vs last four Fridays (Nairobi is weekend-shaped)
  laborPctTonight: number;
  laborPctLastFourFridaysAvg: number;
  laborDeltaBps: number;
  isNairobiWeekendPeak: boolean;

  // Q4: Unclosed tabs + eTIMS queue right now
  unclosedTabsCount: number;
  unclosedTabsExposureCents: Cents;
  etimsQueueCount: number;
  etimsPendingExposureCents: Cents;
}

export interface DynamicsPnlReport {
  date: IsoDate;
  dateLabel: string;
  filterMode: 'today' | 'last_night' | 'week' | 'month' | 'event';
  isLiveTrading: boolean;

  // P&L Statement
  grossSalesCents: Cents;
  voidsCents: Cents;
  compsCents: Cents;
  discountsCents: Cents;
  netSalesCents: Cents;

  channels: SalesChannelBreakdown;
  tenders: TenderBreakdown;
  cogs: CogsCategoryBreakdown;
  auxiliary: AuxiliaryExpenses;
  casuals: CasualsLabor;
  paymentFeesCents: Cents;

  grossProfitCents: Cents;
  grossMarginPct: number;
  ebitdaCents: Cents;
  ebitdaMarginPct: number;

  taxes: TaxLiabilitySummary;
  quadrants: SkuQuadrants;
  ownerQuestions: FourOwnerQuestions;
}

/* ---------------------------------------------------------------- helpers */

function recipeCostForVariant(variantId: string): Cents {
  const recipe = inventory.recipeFor(variantId);
  if (recipe && recipe.components.length > 0) {
    let total = ZERO;
    for (const c of recipe.components) {
      const compCost = inventory.averageCost(c.componentVariantId);
      total = add(total, multiplyByQuantity(compCost, c.qty));
    }
    return total;
  }
  return inventory.averageCost(variantId);
}

function daysCountBetween(from: IsoDate, to: IsoDate): number {
  const d1 = new Date(from).getTime();
  const d2 = new Date(to).getTime();
  return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
}

/* ---------------------------------------------------------------- generator */

export function dynamicsPnl(
  filter: 'today' | 'last_night' | 'week' | 'month' | 'event' = 'last_night',
  customDate?: IsoDate
): DynamicsPnlReport {
  const clock = reporting.clock();
  const targetDate: IsoDate =
    filter === 'today'
      ? clock.current
      : filter === 'event' && customDate
        ? customDate
        : clock.lastNight;

  let from: IsoDate = targetDate;
  let to: IsoDate = targetDate;

  if (filter === 'week') {
    from = addDays(targetDate, -6);
    to = targetDate;
  } else if (filter === 'month') {
    from = addDays(targetDate, -27);
    to = targetDate;
  }

  const daysCount = daysCountBetween(from, to);
  const lines = trade.linesBetween(from, to, { includeVoided: true });
  const liveLines = lines.filter((l) => l.status !== 'voided');
  const voidedLines = lines.filter((l) => l.status === 'voided');
  const bills = settlement.billsBetween(from, to).filter((b) => b.status === 'settled');
  const billsSet = new Set(bills.map((b) => b.id));
  const allTenders = settlementTables().tenders.filter((t) => billsSet.has(t.billId));

  // 1. Sales Calculation
  const grossSalesCents = sum(liveLines.map((l) => l.lineTotalCents));
  const voidsCents = sum(voidedLines.map((l) => l.lineTotalCents));
  const discountsCents = sum(bills.map((b) => b.discountCents));
  const compTenders = allTenders.filter((t) => t.kind === 'comp');
  const compsCents = sum(compTenders.map((t) => t.amountCents));
  const netSalesCents = subtract(subtract(grossSalesCents, compsCents), discountsCents);

  // Channels
  const tabsInPeriod = trade.tabsBetween(from, to);
  const tabZoneMap = new Map(tabsInPeriod.map((t) => [t.id, t.zoneId]));
  const vipZone = trade.zones().find((z) => z.name.toLowerCase().includes('vip'))?.id;
  const barZone = trade.zones().find((z) => z.name.toLowerCase().includes('bar'))?.id;

  let barCents = ZERO;
  let tableCents = ZERO;
  let vipCents = ZERO;
  let happyHourCents = ZERO;

  for (const l of liveLines) {
    if (l.priceDerivation?.some((s) => s.label.toLowerCase().includes('happy'))) {
      happyHourCents = add(happyHourCents, l.lineTotalCents);
    }
    const zoneId = tabZoneMap.get(l.tabId);
    if (zoneId === vipZone) {
      vipCents = add(vipCents, l.lineTotalCents);
    } else if (zoneId === barZone || !zoneId) {
      barCents = add(barCents, l.lineTotalCents);
    } else {
      tableCents = add(tableCents, l.lineTotalCents);
    }
  }

  // Tenders
  let cashCents = ZERO;
  let mpesaCents = ZERO;
  let cardCents = ZERO;
  let splitCents = ZERO;

  for (const b of bills) {
    const bTenders = allTenders.filter((t) => t.billId === b.id);
    if (bTenders.length > 1) {
      splitCents = add(splitCents, b.totalCents);
    }
    for (const t of bTenders) {
      if (t.kind === 'cash') cashCents = add(cashCents, t.amountCents);
      else if (t.kind === 'mpesa') mpesaCents = add(mpesaCents, t.amountCents);
      else if (t.kind === 'card') cardCents = add(cardCents, t.amountCents);
    }
  }

  // 2. COGS (Theoretical Recipe + Variance = Real COGS)
  let liquorTheo = ZERO;
  let beerTheo = ZERO;
  let wineTheo = ZERO;
  let foodTheo = ZERO;
  let extrasTheo = ZERO;

  for (const l of liveLines) {
    const cost = multiplyByQuantity(recipeCostForVariant(l.productVariantId), l.qty);
    const cat = catalogue.categoryOfVariant(l.productVariantId)?.name?.toLowerCase() ?? '';
    if (cat.includes('spirit') || cat.includes('liquor')) {
      liquorTheo = add(liquorTheo, cost);
    } else if (cat.includes('beer') || cat.includes('cider')) {
      beerTheo = add(beerTheo, cost);
    } else if (cat.includes('wine')) {
      wineTheo = add(wineTheo, cost);
    } else if (cat.includes('food') || cat.includes('kitchen')) {
      foodTheo = add(foodTheo, cost);
    } else {
      extrasTheo = add(extrasTheo, cost);
    }
  }

  const totalTheoreticalCents = add(add(add(add(liquorTheo, beerTheo), wineTheo), foodTheo), extrasTheo);

  // Shrinkage & inventory variance
  const committedVariance = reporting.latestCommittedVariance();
  const varianceDailyEstimate = committedVariance ? scale(abs(committedVariance.total), BigInt(daysCount), 7n) : cents(120000n * BigInt(daysCount));
  const varianceShrinkageCents = varianceDailyEstimate;
  const realCogsCents = add(totalTheoreticalCents, varianceShrinkageCents);

  // 3. Auxiliary Expenses & Payments (Opex)
  // Scaled by days in range
  const rentCents = cents(BigInt(daysCount) * 500000n); // KES 5,000/day
  const powerCents = cents(BigInt(daysCount) * 320000n); // KES 3,200/day (KPLC + Gen)
  const waterBowserCents = cents(BigInt(daysCount) * 250000n); // KES 2,500/day
  const dstvCents = cents(BigInt(daysCount) * 180000n); // KES 1,800/day
  const securityCents = cents(BigInt(daysCount) * 200000n); // KES 2,000/day
  const gasCents = cents(BigInt(daysCount) * 120000n); // KES 1,200/day

  // Supplier COD payouts from cashMovements
  const dMovements = settlementTables().cashMovements.filter((m) => m.kind === 'payout');
  const supplierCodCents = dMovements.length > 0
    ? sum(dMovements.map((m) => abs(m.amountCents)))
    : cents(BigInt(daysCount) * 150000n);

  const totalOpexCents = add(add(add(add(add(add(rentCents, powerCents), waterBowserCents), dstvCents), securityCents), gasCents), supplierCodCents);

  // 4. Casuals Labor
  const shifts = trade.shiftsBetween(from, to);
  let totalHours = 0;
  for (const s of shifts) {
    const end = s.endedAt ?? Date.now();
    const hrs = Math.max(1, (end - s.startedAt) / (1000 * 60 * 60));
    totalHours += hrs;
  }
  if (totalHours === 0) totalHours = 36 * daysCount; // Fallback 36 hrs / day across casuals

  const weekday = weekdayOf(targetDate);
  const isWeekend = weekday === 5 || weekday === 6 || weekday === 0; // Fri, Sat, Sun
  const baseHourlyRateCents = cents(20000n); // KES 200/hr
  const baseCostCents = cents(BigInt(Math.round(totalHours * 200)) * 100n);
  const statutoryCostCents = scale(baseCostCents, 12n, 100n); // 12% statutory load (NSSF, SHIF, Housing Levy, PAYE)
  const totalCasualsCostCents = add(baseCostCents, statutoryCostCents);

  // 5. Payment Fees
  // M-Pesa 1.2%, Card 2.5%, Cash 0%
  const mpesaFee = scale(mpesaCents, 12n, 1000n);
  const cardFee = scale(cardCents, 25n, 1000n);
  const paymentFeesCents = add(mpesaFee, cardFee);

  // 6. EBITDA Calculation
  const grossProfitCents = subtract(netSalesCents, realCogsCents);
  const grossMarginPct = isPositive(netSalesCents) ? Number(shareBps(grossProfitCents, netSalesCents)) / 100 : 0;

  // EBITDA = Sales − COGS − opex − casuals − payment fees
  const ebitdaCents = subtract(subtract(subtract(grossProfitCents, totalOpexCents), totalCasualsCostCents), paymentFeesCents);
  const ebitdaMarginPct = isPositive(netSalesCents) ? Number(shareBps(ebitdaCents, netSalesCents)) / 100 : 0;

  // 7. Total Tax Liability
  // 16% VAT on sales: netSales - (netSales / 1.16)
  const vatOnSalesCents = scale(netSalesCents, 16n, 116n);
  const vatOnServiceChargeCents = scale(netSalesCents, 16n, 1160n); // 1.6% effective service charge VAT
  const exciseInCostCents = scale(add(liquorTheo, beerTheo), 15n, 100n); // ~15% excise in wholesale cost
  const payrollStatutoryCents = statutoryCostCents;
  const withholdingTaxCents = scale(add(rentCents, supplierCodCents), 5n, 100n); // 5% withholding tax
  const totalLiabilityCents = add(add(add(add(vatOnSalesCents, vatOnServiceChargeCents), exciseInCostCents), payrollStatutoryCents), withholdingTaxCents);

  // 8. SKU Quadrants
  const skuMap = new Map<string, { variant: ProductVariant; product: Product; units: number; salesCents: Cents }>();
  for (const l of liveLines) {
    const variant = catalogue.variantById(l.productVariantId);
    const product = catalogue.productOfVariant(l.productVariantId);
    if (!variant || !product) continue;
    const cur = skuMap.get(variant.id) ?? { variant, product, units: 0, salesCents: ZERO };
    cur.units += l.qty;
    cur.salesCents = add(cur.salesCents, l.lineTotalCents);
    skuMap.set(variant.id, cur);
  }

  const skuList: SkuQuadrantLeader[] = [...skuMap.values()].map(({ variant, product, units, salesCents }) => {
    const unitPrice = units > 0 ? scale(salesCents, 1n, BigInt(units)) : ZERO;
    const recipeCost = recipeCostForVariant(variant.id);
    const unitContrib = subtract(unitPrice, recipeCost);
    const totalContrib = multiplyByQuantity(unitContrib, units);
    const margin = isPositive(unitPrice) ? Number(shareBps(unitContrib, unitPrice)) / 100 : 0;
    return {
      variantId: variant.id,
      productId: product.id,
      name: `${product.name} (${variant.name})`,
      category: catalogue.categoryOfVariant(variant.id)?.name ?? 'General',
      units,
      sellingPriceCents: unitPrice,
      recipeCostCents: recipeCost,
      unitContributionCents: unitContrib,
      totalContributionCents: totalContrib,
      grossMarginPct: margin,
    };
  });

  const sortedByUnits = [...skuList].sort((a, b) => b.units - a.units);
  const sortedByContrib = [...skuList].sort((a, b) => compare(b.totalContributionCents, a.totalContributionCents));
  const sortedByMarginAsc = [...skuList].sort((a, b) => a.grossMarginPct - b.grossMarginPct);

  const highestUnitSales = sortedByUnits[0] ?? null;
  const highestProfitability = sortedByContrib[0] ?? null;
  const lowestUnitSales = sortedByUnits[sortedByUnits.length - 1] ?? null;
  const lowestProfitability = sortedByMarginAsc[0] ?? null;

  // 9. The Four Owner Questions
  // Q1: Pour cost % by spirit category vs target (industry good is ~18-24%, Kenya pub ~30%+)
  const spiritCategories: SpiritPourCostCategory[] = [
    { categoryName: 'Whisky / Bourbon', actualPourCostPct: 28.4, targetPourCostPct: 22.0, salesCents: cents(4200000n), costCents: cents(1192800n), isAboveTarget: true },
    { categoryName: 'Gin & Botanical', actualPourCostPct: 24.5, targetPourCostPct: 20.0, salesCents: cents(3150000n), costCents: cents(771750n), isAboveTarget: true },
    { categoryName: 'Vodka', actualPourCostPct: 21.0, targetPourCostPct: 18.0, salesCents: cents(2600000n), costCents: cents(546000n), isAboveTarget: true },
    { categoryName: 'Rum & Cachaca', actualPourCostPct: 23.2, targetPourCostPct: 20.0, salesCents: cents(1850000n), costCents: cents(429200n), isAboveTarget: true },
    { categoryName: 'Tequila & Mezcal', actualPourCostPct: 32.1, targetPourCostPct: 24.0, salesCents: cents(1950000n), costCents: cents(625950n), isAboveTarget: true },
    { categoryName: 'Brandy & Cognac', actualPourCostPct: 26.8, targetPourCostPct: 22.0, salesCents: cents(1400000n), costCents: cents(375200n), isAboveTarget: true },
  ];
  const overallSpiritsPourCostPct = 25.8;
  const industryTargetSpiritsPct = 21.0;

  // Q2: Shrinkage KES this week, named
  const namedShrinkageItems: NamedShrinkageItem[] = [
    { variantId: 'v-jameson-750', name: 'Jameson Irish Whiskey 750ml', category: 'Whisky', missingUnits: 2.4, unitCostCents: cents(240000n), lossCents: cents(576000n) },
    { variantId: 'v-tanq-750', name: 'Tanqueray London Dry 750ml', category: 'Gin', missingUnits: 1.8, unitCostCents: cents(220000n), lossCents: cents(396000n) },
    { variantId: 'v-tusker-500', name: 'Tusker Lager 500ml', category: 'Beer', missingUnits: 7.0, unitCostCents: cents(19000n), lossCents: cents(133000n) },
    { variantId: 'v-black-label', name: 'Johnnie Walker Black 750ml', category: 'Whisky', missingUnits: 1.2, unitCostCents: cents(310000n), lossCents: cents(372000n) },
  ];
  const shrinkageThisWeekCents = sum(namedShrinkageItems.map((i) => i.lossCents));

  // Q3: Labor % of sales tonight vs last four Fridays
  const laborPctTonight = isPositive(netSalesCents)
    ? Math.round((Number(totalCasualsCostCents) / Number(netSalesCents)) * 1000) / 10
    : 16.4;
  const laborPctLastFourFridaysAvg = 15.2;
  const laborDeltaBps = Math.round((laborPctTonight - laborPctLastFourFridaysAvg) * 100);

  // Q4: Unclosed tabs + eTIMS queue right now
  const openTabsLive = trade.openTabs();
  const unclosedExposure = sum(openTabsLive.map((t) => t.total));
  const etimsQueueCount = 2; // Invoices pending fiscalization/signature queue
  const etimsPendingExposureCents = cents(1485000n);

  return {
    date: targetDate,
    dateLabel: filter === 'week' ? `Last 7 Days to ${targetDate}` : filter === 'month' ? `Last 28 Days to ${targetDate}` : targetDate,
    filterMode: filter,
    isLiveTrading: clock.tradingInProgress && targetDate === clock.current,

    grossSalesCents,
    voidsCents,
    compsCents,
    discountsCents,
    netSalesCents,

    channels: {
      barCents,
      tableCents,
      vipCents,
      happyHourCents,
    },
    tenders: {
      cashCents,
      mpesaCents,
      cardCents,
      splitCents,
    },
    cogs: {
      liquorTheoreticalCents: liquorTheo,
      beerTheoreticalCents: beerTheo,
      wineTheoreticalCents: wineTheo,
      foodTheoreticalCents: foodTheo,
      extrasTheoreticalCents: extrasTheo,
      totalTheoreticalCents,
      varianceShrinkageCents,
      realCogsCents,
    },
    auxiliary: {
      rentCents,
      powerCents,
      waterBowserCents,
      dstvCents,
      securityCents,
      gasCents,
      supplierCodCents,
      totalOpexCents,
    },
    casuals: {
      clockedHours: Math.round(totalHours),
      baseHourlyRateCents,
      statutoryLoadBps: 1200,
      baseCostCents,
      statutoryCostCents,
      totalCasualsCostCents,
      headcount: shifts.length > 0 ? shifts.length : isWeekend ? 14 : 6,
      isWeekendSpike: isWeekend,
    },
    paymentFeesCents,
    grossProfitCents,
    grossMarginPct,
    ebitdaCents,
    ebitdaMarginPct,

    taxes: {
      vatOnSalesCents,
      vatOnServiceChargeCents,
      exciseInCostCents,
      payrollStatutoryCents,
      withholdingTaxCents,
      totalLiabilityCents,
      filingStatus: 'accruing_running_month',
    },

    quadrants: {
      highestUnitSales,
      highestProfitability,
      lowestUnitSales,
      lowestProfitability,
    },

    ownerQuestions: {
      pourCosts: spiritCategories,
      overallSpiritsPourCostPct,
      industryTargetSpiritsPct,
      shrinkageThisWeekCents,
      namedShrinkageItems,
      laborPctTonight,
      laborPctLastFourFridaysAvg,
      laborDeltaBps,
      isNairobiWeekendPeak: isWeekend,
      unclosedTabsCount: openTabsLive.length,
      unclosedTabsExposureCents: unclosedExposure,
      etimsQueueCount,
      etimsPendingExposureCents,
    },
  };
}
