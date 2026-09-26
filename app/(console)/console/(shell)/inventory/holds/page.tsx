import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { HoldsView } from './holds-view';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Holds' };

/**
 * Holds, docs/10 N3: the manager's control over what the floor can sell. A hold outranks the
 * computed stock figure in every case and reaches every tablet on its next pull.
 */
export default function HoldsPage() {
  const tz = identity.outlet().timezone;
  const active = inventory.activeHolds().map((h) => ({
    id: h.id,
    variantId: h.productVariantId,
    product: catalogue.productOfVariant(h.productVariantId)?.name ?? '',
    variant: catalogue.variantById(h.productVariantId)?.name ?? '',
    placedBy: identity.displayName(h.placedBy),
    placedAt: h.placedAt,
    reason: h.reason,
    expectedBack: h.expectedBack,
  }));
  const released = inventory
    .holds()
    .filter((h) => h.status === 'released')
    .sort((a, b) => (b.releasedAt ?? 0) - (a.releasedAt ?? 0))
    .slice(0, 10)
    .map((h) => ({
      id: h.id,
      variant: catalogue.variantById(h.productVariantId)?.name ?? '',
      reason: h.reason,
      releaseNote: h.releaseNote,
      releasedBy: identity.displayName(h.releasedBy),
      placedAt: h.placedAt,
      releasedAt: h.releasedAt ?? 0,
    }));
  const holdable = catalogue
    .stockVariants()
    .filter((v) => !active.some((h) => h.variantId === v.id))
    .map((v) => ({ value: v.id, label: v.name }));
  return (
    <>
      <ViewHeader page="/console/inventory/holds" />
      <HoldsView active={active} released={released} holdable={holdable} timezone={tz} />
    </>
  );
}
