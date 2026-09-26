import type { AvailabilityReason, AvailabilityState, CategoryColourToken } from '@bliss/shared/domain';
import type { Cents } from '@bliss/shared/money';
import type { Metadata } from 'next';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import * as identity from '@/modules/identity/service';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconClipboardList } from '@tabler/icons-react';
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
  value: Cents;
  velocity: number;
  daysCover: number | null;
  state: AvailabilityState;
  reason: AvailabilityReason | null;
  holdId: string | null;
  holdReason: string | null;
  variancePct: number | null;
  attention: boolean;
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

  const rows: StockRow[] = [];
  for (const variant of catalogue.stockVariants()) {
    const product = catalogue.productById(variant.productId)!;
    const category = catalogue.categoryById(product.categoryId)!;
    const sellable = catalogue.variants().find((v) => v.productId === product.id && v.isDefault) ?? variant;
    const entry = availability.evaluate(sellable.id);
    const hold = holds.find((h) => h.productVariantId === variant.id) ?? null;
    const velocity = inventory.velocityPerDay(variant.id);
    const totalOnHand = inventory.onHand(variant.id);
    const unitCost = inventory.averageCost(variant.id);
    const variance = inventory.latestVariance(variant.id);
    const unit = product.containerVolumeMl && catalogue.variants().some((v) => v.productId === product.id && v.kind === 'serve') ? 'bottles' : 'units';
    const scopes = locationFilter ? locations.filter((l) => l.id === locationFilter) : [null];
    for (const location of scopes) {
      const onHand = location ? inventory.onHand(variant.id, location.id) : totalOnHand;
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
        value: inventory.valueAtCost(variant.id, Math.max(0, onHand)),
        velocity,
        daysCover: velocity > 0 ? totalOnHand / velocity : null,
        state: entry.state,
        reason: entry.reason,
        holdId: hold?.id ?? null,
        holdReason: hold?.reason ?? null,
        variancePct: variance?.pct ?? null,
        attention: entry.state !== 'available' || totalOnHand <= product.reorderPoint || totalOnHand <= threshold || (variance !== null && Math.abs(variance.pct) > 2),
      });
    }
  }

  return (
    <>
      <ViewHeader
        page="/console/inventory/stock"
        actions={
          <ButtonLink href="/console/inventory/counts/new" variant="outline" icon={IconClipboardList}>
            Start a count
          </ButtonLink>
        }
      />

    <StockTable
      rows={rows}
      locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      categories={catalogue.categories().filter((c) => c.trackStock).map((c) => ({ value: c.id, label: c.name }))}
      exportDate={new Date().toISOString().slice(0, 10)}
    />
    </>
  );
}
