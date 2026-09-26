import { describeRuleWindow } from '@bliss/shared/pricing';
import type { Metadata } from 'next';
import * as audit from '@/modules/audit/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import { type PriceRow, PriceListView } from './price-list-view';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Price lists' };

/**
 * N-03. One list at a time, every item against the base price, with the margin at average cost for
 * roles that may read cost. The cost column is left out of the rows entirely otherwise. docs/01 R10.
 */
export default async function PriceListsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const actor = await identity.currentConsoleActor();
  const lists = pricing
    .priceLists()
    .filter((l) => l.status === 'active')
    .sort((a, b) => a.priority - b.priority);
  const base = lists.find((l) => l.kind === 'base') ?? lists[0]!;
  const list = lists.find((l) => l.id === params.list) ?? base;
  const baseItems = pricing.itemsFor(base.id);
  const listItems = pricing.itemsFor(list.id);
  const canSeeCost = identity.can(actor.staffId, 'cost.read');
  const rules = pricing.rules().filter((r) => r.priceListId === list.id && r.status === 'active');

  const rows: PriceRow[] = catalogue
    .variants()
    .filter((v) => v.status === 'active')
    .map((v) => {
      const product = catalogue.productById(v.productId)!;
      const baseItem = baseItems.find((i) => i.productVariantId === v.id) ?? null;
      const item = listItems.find((i) => i.productVariantId === v.id) ?? null;
      const stock = catalogue.stockVariantFor(v.id);
      const recipe = inventory.recipeFor(v.id);
      const unitCost = !canSeeCost
        ? null
        : recipe
          ? null
          : stock
            ? inventory.valueAtCost(stock.stockVariantId, stock.factor)
            : null;
      return {
        variantId: v.id,
        name: v.name,
        productId: product.id,
        categoryId: product.categoryId,
        category: catalogue.categoryById(product.categoryId)?.name ?? '',
        base: baseItem?.priceCents ?? null,
        price: item?.priceCents ?? null,
        cost: unitCost,
      };
    })
    .filter((r) => list.kind === 'base' || r.price !== null || r.base !== null);

  const changes = audit
    .list({ action: 'price.changed' })
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      at: e.occurredAt,
      by: identity.displayName(e.actorStaffId),
      reason: e.reason,
      before: (e.before as { priceCents?: string; variant?: string } | null)?.priceCents ?? null,
      after: (e.after as { priceCents?: string; variant?: string } | null)?.priceCents ?? null,
      variant: (e.after as { variant?: string } | null)?.variant ?? (e.before as { variant?: string } | null)?.variant ?? null,
    }));

  return (
    <>
      <ViewHeader page="/console/pricing/lists" />

    <PriceListView
      lists={lists.map((l) => ({ value: l.id, label: l.name }))}
      list={{ id: list.id, name: list.name, kind: list.kind }}
      baseName={base.name}
      rules={rules.map((r) => `${r.name}: ${describeRuleWindow(r)}`)}
      rows={rows}
      canSeeCost={canSeeCost}
      canEdit={identity.can(actor.staffId, 'price.write')}
      categories={catalogue.categories().map((c) => ({ value: c.id, label: c.name }))}
      changes={changes}
      timezone={identity.outlet().timezone}
      taxRateBps={identity.outlet().taxRateBps}
    />
    </>
  );
}
