import { shillings } from '@bliss/shared/money';
import { beforeAll, describe, expect, it } from 'vitest';
import { ownerActor } from '../test/actors';
import { dataset } from './_data/source';
import * as availability from './availability/service';
import * as catalogue from './catalogue/service';
import * as inventory from './inventory/service';
import { SHEET_2026_09_28 } from './inventory/sheets/2026-09-28';
import * as stockSheet from './inventory/stock-sheet';
import * as pricing from './pricing/service';
import * as settlement from './settlement/service';

/**
 * The paper stock sheet for Monday 28 September, booked into the outlet as handed over: the real
 * menu, which every line on the sheet must name. What the shelf holds after is the closing count,
 * the night's sales are one bill on that day, and the menu gains the tots and the cigarette sticks.
 */

// Tuesday afternoon, after Monday's business day has closed.
const NOW = Date.parse('2026-09-29T14:00:00+03:00');
const sheet = SHEET_2026_09_28;

beforeAll(() => {
  process.env.BLISS_DATASET = 'handover';
  const g = globalThis as { __blissDataset?: unknown; __blissRevision?: unknown };
  g.__blissDataset = undefined;
  g.__blissRevision = undefined;
});

const product = (name: string) => {
  const p = catalogue.products().find((x) => x.name === name);
  if (!p) throw new Error(`${name} is not on the menu`);
  return p;
};
const sealed = (name: string) => catalogue.variants().find((v) => v.productId === product(name).id && v.kind === 'sealed')!;
const way = (name: string, variant: string) => catalogue.variants().find((v) => v.productId === product(name).id && v.name === variant);
const onHand = (name: string) => inventory.onHand(sealed(name).id);

describe('the stock sheet for Monday 28 September', () => {
  it('names only what is on the menu, and adds up: its sales are its payments', () => {
    const plan = stockSheet.planSheet(sheet, NOW);
    expect(plan.missing).toEqual([]);
    expect(plan.applied).toBeNull();
    expect(plan.salesTotal).toBe(shillings(6065));
    expect(plan.tenders.reduce((n, t) => n + t.amount, 0n)).toBe(shillings(6065));
    // Every line balances but KC, where three left the shelf and two were paid for.
    expect(plan.rows.filter((r) => r.variance !== 0).map((r) => [r.item, r.variance])).toEqual([['KC 250ml', -1]]);
  });

  it('books the counts, the night and the menu, once', () => {
    const result = stockSheet.applySheet({ sheetId: sheet.id, reason: 'The first full stock take, from the paper sheet', actor: ownerActor(), now: NOW });
    expect(result.items).toBe(sheet.counts.length);

    // The shelf holds the closing count.
    expect(onHand('Tusker Lager')).toBe(33);
    expect(onHand('Savanna')).toBe(45);
    expect(onHand('Tusker Lite can')).toBe(12);
    expect(onHand('Guarana can')).toBe(11);
    expect(onHand('KC 250ml')).toBe(36);
    expect(onHand('Water 500ml')).toBe(225);
    // A tot pours a share of the open bottle, which the sheet still counts as a bottle.
    expect(onHand('Gilbeys 750ml')).toBeCloseTo(2 - 25 / 750, 4);
    expect(onHand('Jose Cuervo 750ml')).toBeCloseTo(1 - 25 / 750, 4);

    // A blank line is counted at 0, not left "Not counted".
    expect(onHand('Tusker Ndimu')).toBe(0);
    expect(inventory.stockRecorded(sealed('Tusker Ndimu').id)).toBe(true);
    expect(availability.evaluate(sealed('Tusker Ndimu').id).reason).toBe('stock');

    // KC's missing bottle is a variance on the record, at the close, not a sale.
    const kc = inventory.movements({ variantId: sealed('KC 250ml').id }).filter((m) => m.sourceType === 'stock_sheet');
    expect(kc.some((m) => m.qtyDelta === -1 && /fewer than the sales leave/.test(m.reason ?? ''))).toBe(true);

    // Cigarettes: kept and sold by the stick, and a pack takes twenty.
    expect(onHand('Pall Mall Red')).toBe(84);
    expect(sealed('Pall Mall Red').name).toBe('Pall Mall Red, stick');
    expect(pricing.currentPrice(sealed('Pall Mall Red').id, NOW)?.unitPriceCents).toBe(shillings(10));
    const pack = way('Pall Mall Red', 'Pall Mall Red, pack of 20')!;
    expect(pricing.currentPrice(pack.id, NOW)?.unitPriceCents).toBe(shillings(200));
    expect(availability.evaluate(pack.id).qtyAvailable).toBe(4);
    expect(pricing.currentPrice(sealed('Dunhill Double').id, NOW)?.unitPriceCents).toBe(shillings(20));

    // Tots: a 25ml share of their bottle, at the house price.
    const tot = way('Gilbeys 750ml', 'Gilbeys 750ml, tot')!;
    expect(tot.depletionFactor).toBeCloseTo(25 / 750, 4);
    expect(pricing.currentPrice(tot.id, NOW)?.unitPriceCents).toBe(shillings(100));
    expect(way('Double Black 1 litre', 'Double Black 1 litre, tot')!.depletionFactor).toBeCloseTo(0.025, 4);
    expect(product('Amarula').containerVolumeMl).toBe(750);
    expect(pricing.currentPrice(sealed('Bond 7 375ml').id, NOW)?.unitPriceCents).toBe(shillings(850));

    // The night's sales are one bill on Monday, and count as sold that day.
    const monday = settlement.soldLinesBetween('2026-09-28', '2026-09-28');
    const sold = (id: string) => monday.filter((l) => l.productVariantId === id).reduce((n, l) => n + l.qty, 0);
    expect(sold(sealed('Tusker Lager').id)).toBe(5);
    expect(sold(sealed('Rothmans').id)).toBe(22);
    const plan = stockSheet.planSheet(sheet, NOW);
    expect(plan.applied?.billNumber).toBe(result.billNumber);
    const bill = settlement.billsOn('2026-09-28').find((b) => b.billNumber === result.billNumber)!;
    expect(bill.businessDate).toBe('2026-09-28');
    expect(bill.totalCents).toBe(shillings(6065));
    // The reports reach back to the night the sheet records.
    expect(dataset().firstBusinessDate <= '2026-09-28').toBe(true);

    // Booked once.
    expect(() => stockSheet.applySheet({ sheetId: sheet.id, reason: 'Again, by mistake', actor: ownerActor(), now: NOW })).toThrow(/already booked/);
    expect(stockSheet.sheetsToBook(NOW)).toEqual([]);
  });
});
