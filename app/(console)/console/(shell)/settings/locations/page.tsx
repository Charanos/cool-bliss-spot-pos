import { ZERO, add, multiplyByQuantity } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { ViewHeader } from '../../_components/workspace';
import { type LocationRow, LocationsView } from './locations-view';

export const metadata: Metadata = { title: 'Stock locations' };

/** Where stock is kept, what each place holds, and which two places deliveries and sales use. */
export default async function LocationsPage() {
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'stock.count.commit');
  const seeCost = identity.can(actor.staffId, 'cost.read');
  const items = catalogue.stockVariants();
  const rows: LocationRow[] = inventory.locations().map((l) => {
    let held = 0;
    let units = 0;
    let value = ZERO;
    for (const v of items) {
      const qty = inventory.onHand(v.id, l.id);
      if (Math.abs(qty) < 1e-6) continue;
      held += 1;
      units += qty;
      if (seeCost) value = add(value, multiplyByQuantity(inventory.averageCost(v.id), qty));
    }
    return { id: l.id, name: l.name, kind: l.kind, isDefaultReceipt: l.isDefaultReceipt, isDefaultSale: l.isDefaultSale, status: l.status, held, units: Math.round(units * 100) / 100, value: seeCost ? value : null };
  });
  return (
    <>
      <ViewHeader
        page="/console/settings/locations"
        actions={
          canEdit ? (
            <ButtonLink href="/console/settings/locations?new=1" variant="create" icon={IconPlus}>
              Add a location
            </ButtonLink>
          ) : null
        }
      />
      <LocationsView rows={rows} canEdit={canEdit} />
    </>
  );
}
