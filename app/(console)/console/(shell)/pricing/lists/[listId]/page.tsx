import { describeRuleWindow } from '@bliss/shared/pricing';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { StatusChip } from '@bliss/ui/components/status';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as audit from '@/modules/audit/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { PriceListView } from '../price-list-view';
import { priceRows } from '../rows';
import { ListActions } from './list-actions';

export async function generateMetadata({ params }: { params: Promise<{ listId: string }> }): Promise<Metadata> {
  const { listId } = await params;
  return { title: pricing.priceLists().find((l) => l.id === listId)?.name ?? 'Price list' };
}

/**
 * N-03. One price list: every item against the base price, its margin for roles that may read cost,
 * the rules that switch it on and the zones that price from it. docs/01 R10.
 */
export default async function PriceListPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const list = pricing.priceLists().find((l) => l.id === listId);
  if (!list) notFound();
  const actor = await identity.currentConsoleActor();
  const canSeeCost = identity.can(actor.staffId, 'cost.read');
  const canEdit = identity.can(actor.staffId, 'price.write');
  const lists = pricing.priceLists().filter((l) => l.status === 'active');
  const base = lists.filter((l) => l.kind === 'base').sort((a, b) => b.priority - a.priority)[0] ?? list;
  const rules = pricing.rules().filter((r) => r.priceListId === list.id && r.status === 'active');
  const zones = trade.zones().filter((z) => z.defaultPriceListId === list.id && z.status === 'active');
  const changes = audit
    .list({ action: 'price.changed' })
    .filter((e) => (e.after as { list?: string } | null)?.list === list.name || (e.before as { list?: string } | null)?.list === list.name)
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      at: e.occurredAt,
      by: identity.displayName(e.actorStaffId),
      reason: e.reason,
      before: (e.before as { priceCents?: string } | null)?.priceCents ?? null,
      after: (e.after as { priceCents?: string } | null)?.priceCents ?? null,
      variant: (e.after as { variant?: string } | null)?.variant ?? (e.before as { variant?: string } | null)?.variant ?? null,
    }));

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={list.name} />
      <DetailHeader
        back={{ href: '/console/pricing/lists', label: 'Price lists' }}
        title={list.name}
        status={<StatusChip status={list.status === 'active' ? 'active' : 'retired'} label={list.status === 'active' ? (list.id === base.id ? 'Base, all day' : list.kind === 'base' ? 'Base' : 'Overlay') : 'Archived'} />}
        meta={<MetaRow items={[{ label: 'Priority', value: String(list.priority) }, { value: `${pricing.itemsFor(list.id).length} prices` }]} />}
        actions={<ListActions list={{ id: list.id, name: list.name, kind: list.kind, priority: list.priority }} active={list.status === 'active'} lists={lists.map((l) => ({ value: l.id, label: l.name }))} canEdit={canEdit} />}
      />

      {rules.length > 0 || zones.length > 0 ? (
        <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          {rules.length > 0 ? (
            <Card aria-labelledby="list-rules">
              <CardHeader band level="h2" titleId="list-rules" title="Switched on by" subtitle="The time rules that make this list the price." />
              <LedgerList label="Rules">
                {rules.map((r) => (
                  <LedgerItem key={r.id}>
                    <span className="flex items-baseline justify-between gap-16">
                      <EntityLink kind="rule" id={r.id} className="text-ui">
                        {r.name}
                      </EntityLink>
                      <span className="text-body-sm text-ink-muted">{describeRuleWindow(r)}</span>
                    </span>
                  </LedgerItem>
                ))}
              </LedgerList>
            </Card>
          ) : null}
          {zones.length > 0 ? (
            <Card aria-labelledby="list-zones">
              <CardHeader band level="h2" titleId="list-zones" title="Zones that price from it" subtitle="Tabs opened in these zones use this list." />
              <LedgerList label="Zones">
                {zones.map((z) => (
                  <LedgerItem key={z.id}>
                    <EntityLink kind="zone" id={z.id} className="text-ui">
                      {z.name}
                    </EntityLink>
                  </LedgerItem>
                ))}
              </LedgerList>
            </Card>
          ) : null}
        </div>
      ) : null}

      <PriceListView
        list={{ id: list.id, name: list.name, kind: list.kind }}
        baseName={base.name}
        rules={rules.map((r) => `${r.name}: ${describeRuleWindow(r)}`)}
        rows={priceRows(list, canSeeCost)}
        canSeeCost={canSeeCost}
        canEdit={canEdit && list.status === 'active'}
        categories={catalogue.categories().map((c) => ({ value: c.id, label: c.name }))}
        changes={changes}
        timezone={identity.outlet().timezone}
        taxRateBps={identity.outlet().taxRateBps}
      />
    </div>
  );
}
