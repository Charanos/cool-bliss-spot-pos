import { describeRuleWindow } from '@bliss/shared/pricing';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBand, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { StatusChip } from '@bliss/ui/components/status';
import { IconClock, IconListDetails, IconPlus, IconTag } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';
import * as trade from '@/modules/trade/service';
import { ViewHeader } from '../../_components/workspace';
import { ListsCreate } from './lists-create';

export const metadata: Metadata = { title: 'Price lists' };

/** Every price list as a card: when it applies, how much of the menu it prices, and who uses it. */
export default async function PriceListsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  // The old address named a list in the query; each list now has its own page.
  if (params.list) redirect(`/console/pricing/lists/${encodeURIComponent(params.list)}`);
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'price.write');
  const base = pricingManage.defaultList();
  const onSale = catalogue.variants().filter((v) => v.status === 'active' && catalogue.productById(v.productId)?.status === 'active').length;
  const lists = [...pricing.priceLists()].sort((a, b) => (a.status === b.status ? (a.kind === b.kind ? b.priority - a.priority : a.kind === 'base' ? -1 : 1) : a.status === 'active' ? -1 : 1));
  const rules = pricing.rules().filter((r) => r.status === 'active');
  const zones = trade.zones().filter((z) => z.status === 'active');

  return (
    <>
      <ViewHeader
        page="/console/pricing/lists"
        actions={
          canEdit ? (
            <ButtonLink href="/console/pricing/lists?new=1" variant="create" icon={IconPlus}>
              Add a price list
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-32">
        <MetricGrid columns={3}>
          <Metric label="Lists in use" icon={IconListDetails} value={String(lists.filter((l) => l.status === 'active').length)} detail={base ? `${base.name} is the base` : 'No base list'} />
          <Metric label="Time rules" icon={IconClock} href="/console/pricing/rules" value={String(rules.length)} detail="Switching overlays on in their hours" />
          <Metric label="Items on sale" icon={IconTag} value={String(onSale)} detail="Each needs a base price" />
        </MetricGrid>

        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
          {lists.map((l) => {
            const priced = pricing.itemsFor(l.id).length;
            const mine = rules.filter((r) => r.priceListId === l.id);
            const usedBy = zones.filter((z) => z.defaultPriceListId === l.id);
            return (
              <Card key={l.id} as="article" interactive className="group h-full" tone={l.id === base?.id ? 'accent' : undefined}>
                <CardBand
                  eyebrow={l.kind === 'base' ? (l.id === base?.id ? 'Base, the default' : 'Base') : `Overlay, priority ${l.priority}`}
                  status={l.status === 'archived' ? <StatusChip status="retired" label="Archived" /> : null}
                  title={l.name}
                  subtitle={l.kind === 'base' ? (l.id === base?.id ? 'The base price, all day' : 'A base list') : mine.length > 0 ? mine.map((r) => describeRuleWindow(r)).join('; ') : 'No rule switches it on'}
                  href={`/console/pricing/lists/${l.id}`}
                />
                <KeyRows>
                  <KeyRow label={l.kind === 'base' ? 'Priced' : 'On offer'} tone={l.kind === 'base' && priced < onSale ? 'low' : undefined}>
                    <span className="inline-flex items-center gap-8">
                      <InlineBar value={onSale > 0 ? Math.min(1, priced / onSale) : 0} tone={l.kind === 'base' && priced < onSale ? 'attention' : 'accent'} />
                      {l.kind === 'base' ? `${priced} of ${onSale}` : priced}
                    </span>
                  </KeyRow>
                  <KeyRow label="Priority">{l.priority}</KeyRow>
                  <KeyRow label="Zones">{usedBy.length > 0 ? usedBy.map((z) => z.name).join(', ') : 'None'}</KeyRow>
                </KeyRows>
              </Card>
            );
          })}
        </div>
      </div>
      <ListsCreate canEdit={canEdit} />
    </>
  );
}
