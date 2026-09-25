import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as reporting from '@/modules/reporting/service';
import { businessDayWindow, addDays } from '@bliss/shared/time';
import { MovementsTable } from './movements-table';

export const metadata: Metadata = { title: 'Movements' };

const RANGES = { '1': 1, '3': 3, '7': 7, '28': 28 } as const;

/** The ledger itself: append only, filtered on the server by range so thousands of rows never ship. */
export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const outlet = identity.outlet();
  const clock = reporting.clock();
  const days = RANGES[(params.range ?? '3') as keyof typeof RANGES] ?? 3;
  const from = businessDayWindow(addDays(clock.current, -(days - 1)), outlet.timezone, outlet.businessDayCutover).start;
  const variantId = params.variant ?? null;
  const locations = inventory.locations();

  const rows = inventory
    .movements({ from, variantId })
    .slice(-4000)
    .reverse()
    .map((m) => ({
      id: m.id,
      at: m.occurredAt,
      variantId: m.productVariantId,
      variant: catalogue.variantById(m.productVariantId)?.name ?? '',
      location: locations.find((l) => l.id === m.stockLocationId)?.name ?? '',
      locationId: m.stockLocationId,
      type: m.movementType,
      qty: m.qtyDelta,
      unitCost: m.unitCostCents,
      source: m.sourceType,
      by: identity.displayName(m.createdBy),
      reason: m.reason,
    }));

  return (
    <MovementsTable
      rows={rows}
      timezone={outlet.timezone}
      locations={locations.map((l) => ({ value: l.id, label: l.name }))}
      variantName={variantId ? (catalogue.variantById(variantId)?.name ?? null) : null}
    />
  );
}
