import type { AvailabilityReason, AvailabilityState, CategoryColourToken } from '@bliss/shared/domain';
import type { Cents } from '@bliss/shared/money';
import type { Metadata } from 'next';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import { ZERO, isPositive, multiplyByQuantity } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconClipboardList } from '@tabler/icons-react';
import * as stockSheet from '@/modules/inventory/stock-sheet';
import { BelowZeroNotice } from './below-zero';
import { SheetBaselineLink, SheetNotice } from './sheet-notice';
import { TrialStock } from './trial-stock';
import { StockTable } from './stock-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Stock' };

export interface StockRow {
  id: string;
  variantId: string;
  sellableVariantId: string;
  productId: string;
  supplierId: string | null;
  product: string;
  variant: string;
  categoryId: string;
  categoryName: string;
  colour: CategoryColourToken;
  imageKey: string | null;
  location: string;
  locationId: string;
  onHand: number;
  unit: string;
  unitCost: Cents;
  /** True when the cost is the supplier's price list, because nothing has been received or costed by hand yet. */
  costFromSupplier: boolean;
  value: Cents;
  /** What the guest pays for one, from the price list; null when it is not priced. */
  price: Cents | null;
  /** On hand at that price, the worth the price list gives it before any cost is known. */
  retailValue: Cents | null;
  velocity: number;
  daysCover: number | null;
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  holdId: string | null;
  holdReason: string | null;
  variancePct: number | null;
  attention: boolean;
  /** Stock never received, counted or opened: it sells, and needs its first count or delivery. */
  counted: boolean;
  /** Sold beyond what the record said was there, since its last count or delivery. */
  needsCount: boolean;
}

/**
 * Stock, docs/10 N2: what is in the building, what it is worth, how long it lasts. The state column
 * carries the status the Floor tile shows, so the two surfaces agree, and a hold outranks any figure.
 */
export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const locationFilter = params.location ?? '';
  const locations = inventory.locations();
  const holds = inventory.activeHolds();
  const outlet = identity.outlet();
  const actor = await identity.currentConsoleActor();

  // What the supplier's price list says one costs, for an item no delivery or hand-set cost has priced yet.
  const listCost = new Map<string, Cents>();
  for (const sp of procurement.supplierProducts()) if (isPositive(sp.lastCostCents) && !listCost.has(sp.productVariantId)) listCost.set(sp.productVariantId, sp.lastCostCents);

  const rows: StockRow[] = [];
  for (const variant of catalogue.stockVariants()) {
    const product = catalogue.productById(variant.productId)!;
    const category = catalogue.categoryById(product.categoryId)!;
    const sellable = catalogue.variants().find((v) => v.productId === product.id && v.isDefault) ?? variant;
    const entry = availability.evaluate(sellable.id);
    const hold = holds.find((h) => h.productVariantId === variant.id) ?? null;
    const velocity = inventory.velocityPerDay(variant.id);
    const totalOnHand = inventory.onHand(variant.id);
    const ledgerCost = inventory.averageCost(variant.id);
    const costFromSupplier = !isPositive(ledgerCost) && listCost.has(variant.id);
    const unitCost = isPositive(ledgerCost) ? ledgerCost : (listCost.get(variant.id) ?? ZERO);
    const sellPrice = pricing.currentPrice(sellable.id, Date.now())?.unitPriceCents ?? null;
    const variance = inventory.latestVariance(variant.id);
    const serves = catalogue.variants().filter((v) => v.productId === product.id && v.kind === 'serve' && v.status === 'active');
    // Kept by the stick when a pack is sold as twenty of them; by the bottle when it is poured.
    const unit = serves.some((v) => v.serveVolumeMl === null && v.depletionFactor > 1) ? 'sticks' : product.containerVolumeMl && serves.length > 0 ? 'bottles' : 'units';
    const scopes = locationFilter ? locations.filter((l) => l.id === locationFilter) : [null];
    for (const location of scopes) {
      const raw = location ? inventory.onHand(variant.id, location.id) : totalOnHand;
      const onHand = Math.max(0, raw);
      if (location && location.kind === 'retail' && onHand === 0) continue;
      const threshold = product.lowStockThreshold ?? outlet.lowStockDefault;
      rows.push({
        id: `${variant.id}:${location?.id ?? 'all'}`,
        variantId: variant.id,
        sellableVariantId: sellable.id,
        productId: product.id,
        supplierId: product.defaultSupplierId,
        product: product.name,
        variant: variant.name,
        categoryId: category.id,
        categoryName: category.name,
        colour: category.colourToken,
        imageKey: product.imageKey,
        location: location?.name ?? 'All locations',
        locationId: location?.id ?? locations.find((l) => l.kind === 'service')!.id,
        onHand,
        unit,
        unitCost,
        costFromSupplier,
        value: multiplyByQuantity(unitCost, Math.max(0, onHand)),
        price: sellPrice,
        retailValue: sellPrice === null ? null : multiplyByQuantity(sellPrice, Math.max(0, onHand)),
        velocity,
        daysCover: velocity > 0 ? totalOnHand / velocity : null,
        state: entry.state,
        reason: entry.reason,
        holdId: hold?.id ?? null,
        holdReason: hold?.reason ?? null,
        variancePct: variance?.pct ?? null,
        counted: inventory.stockRecorded(variant.id),
        needsCount: inventory.needsCount(variant.id) || raw < 0,
        attention: !inventory.stockRecorded(variant.id) || inventory.needsCount(variant.id) || raw < 0 || entry.state !== 'available' || totalOnHand <= product.reorderPoint || totalOnHand <= threshold || (variance !== null && Math.abs(variance.pct) > 2),
      });
    }
  }

  const belowZero = inventory.belowZeroCount();

  return (
    <>
      <ViewHeader
        page="/console/inventory/stock"
        actions={
          <>
            {identity.can(actor.staffId, 'stock.count.commit') ? <TrialStock /> : null}
            <ButtonLink href="/console/inventory/counts/new" variant="outline" icon={IconClipboardList}>
              Start a count
            </ButtonLink>
          </>
        }
      />

    {identity.can(actor.staffId, 'stock.count.commit') ? <SheetNotice sheets={stockSheet.sheetsToBook()} /> : null}
    {identity.roleFor(actor.staffId)?.key === 'owner' ? <SheetBaselineLink sheets={stockSheet.sheetsBooked()} /> : null}
    {belowZero > 0 ? <BelowZeroNotice count={belowZero} /> : null}
    <StockTable
      rows={rows}
      locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      categories={catalogue.categories().filter((c) => c.trackStock).map((c) => ({ value: c.id, label: c.name }))}
      exportDate={new Date().toISOString().slice(0, 10)}
    />
    </>
  );
}
