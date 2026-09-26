import { addDays } from '@bliss/shared/time';
import { isZero } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAdjustmentsHorizontal, IconLink, IconPointer } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as reporting from '@/modules/reporting/service';
import * as trade from '@/modules/trade/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ModifierActions } from './modifier-actions';

export async function generateMetadata({ params }: { params: Promise<{ groupId: string }> }): Promise<Metadata> {
  const { groupId } = await params;
  return { title: catalogue.modifierGroups().find((g) => g.group.id === groupId)?.group.name ?? 'Modifier group' };
}

const DAYS = 28;

/** A modifier group: its options, how often each is chosen, and the items that offer it. */
export default async function ModifierGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const found = catalogue.modifierGroups().find((g) => g.group.id === groupId);
  if (!found) notFound();
  const { group } = found;
  const actor = await identity.currentConsoleActor();
  const options = found.modifiers.filter((m) => m.status === 'active').sort((a, b) => a.sortOrder - b.sortOrder);
  const offering = catalogue.variants().filter((v) => catalogue.modifierGroupsFor(v.id).some((x) => x.group.id === group.id));
  const to = reporting.clock().lastNight;
  const lineIds = new Set(trade.linesBetween(addDays(to, -DAYS + 1), to).map((l) => l.id));
  const chosen = trade.readTables().lineModifiers.filter((m) => lineIds.has(m.orderLineId) && options.some((o) => o.id === m.modifierId));
  const times = new Map<string, number>();
  for (const m of chosen) times.set(m.modifierId, (times.get(m.modifierId) ?? 0) + m.qty);
  const most = Math.max(1, ...times.values());

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={group.name} />
      <DetailHeader
        back={{ href: '/console/catalogue/modifiers', label: 'Modifiers' }}
        title={group.name}
        status={<StatusChip status={group.status === 'active' ? 'active' : 'retired'} label={group.status === 'active' ? 'On the floor' : 'Archived'} />}
        meta={<MetaRow items={[{ value: group.minSelect > 0 ? 'Required' : 'Optional' }, { value: `Choose ${group.minSelect === group.maxSelect ? group.maxSelect : `${group.minSelect} to ${group.maxSelect}`}` }]} />}
        actions={
          <ModifierActions
            group={{ id: group.id, name: group.name, minSelect: group.minSelect, maxSelect: group.maxSelect, options: options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents, linkedVariantId: o.linkedVariantId })) }}
            active={group.status === 'active'}
            stockItems={catalogue.stockVariants().map((v) => ({ value: v.id, label: v.name }))}
            items={catalogue
              .variants()
              .filter((v) => v.status === 'active')
              .map((v) => ({ id: v.id, name: v.name, category: catalogue.categoryOfVariant(v.id)?.name ?? '' }))}
            selected={offering.map((v) => v.id)}
            canEdit={identity.can(actor.staffId, 'price.write')}
          />
        }
      />

      <MetricGrid columns={3}>
        <Metric label="Options" icon={IconAdjustmentsHorizontal} value={String(options.length)} detail={`${options.filter((o) => !isZero(o.priceDeltaCents)).length} add to the price`} />
        <Metric label="Items offering it" icon={IconLink} value={String(offering.length)} detail="The floor shows it on these" />
        <Metric label={`Chosen, ${DAYS} days`} icon={IconPointer} tone="poured" value={String(chosen.reduce((n, m) => n + m.qty, 0))} detail="Across every line fired" />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
        <Card aria-labelledby="modifier-options">
          <CardHeader band level="h2" titleId="modifier-options" title="Options" subtitle="What each adds, what stock it takes, and how often it is chosen." />
          <LedgerList label="Options">
            {options.map((o) => (
              <LedgerItem key={o.id}>
                <span className="flex items-center justify-between gap-16">
                  <span className="min-w-0">
                    <span className="block text-ui text-ink">{o.name}</span>
                    {o.linkedVariantId ? (
                      <span className="block text-body-sm text-ink-subtle">
                        Takes stock of{' '}
                        <EntityLink kind="product" id={catalogue.productOfVariant(o.linkedVariantId)?.id} muted>
                          {catalogue.variantById(o.linkedVariantId)?.name}
                        </EntityLink>
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-16">
                    <InlineBar value={(times.get(o.id) ?? 0) / most} />
                    <span className="w-72 text-right font-mono tabular text-num-md text-ink-muted">{times.get(o.id) ?? 0}</span>
                    {isZero(o.priceDeltaCents) ? <span className="w-72 text-right text-body-sm text-ink-subtle">No charge</span> : <Money value={o.priceDeltaCents} currency={false} size="num-md" decimals="whole" className="w-72 justify-end" />}
                  </span>
                </span>
              </LedgerItem>
            ))}
          </LedgerList>
        </Card>

        <Card aria-labelledby="modifier-items">
          <CardHeader band level="h2" titleId="modifier-items" title="Offered on" subtitle="The floor asks for this group when one of these is ordered." />
          {offering.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="No items offer it yet" body="Choose the items that should ask for it." />
            </div>
          ) : (
            <LedgerList label="Items">
              {offering.map((v) => (
                <LedgerItem key={v.id}>
                  <span className="flex items-baseline justify-between gap-16">
                    <EntityLink kind="product" id={v.productId} className="text-ui">
                      {v.name}
                    </EntityLink>
                    <span className="text-body-sm text-ink-subtle">{catalogue.categoryOfVariant(v.id)?.name}</span>
                  </span>
                </LedgerItem>
              ))}
            </LedgerList>
          )}
        </Card>
      </div>
    </div>
  );
}
