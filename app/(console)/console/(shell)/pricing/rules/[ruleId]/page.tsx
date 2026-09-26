import { describeRuleWindow, ruleCoversInstant } from '@bliss/shared/pricing';
import { subtract } from '@bliss/shared/money';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconClock, IconListDetails, IconTag } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricingManage from '@/modules/pricing/manage';
import * as pricing from '@/modules/pricing/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { WeekTimeline } from '../../_parts/week-timeline';
import { RuleActions } from '../rules-client';

export async function generateMetadata({ params }: { params: Promise<{ ruleId: string }> }): Promise<Metadata> {
  const { ruleId } = await params;
  return { title: pricing.rules().find((r) => r.id === ruleId)?.name ?? 'Time rule' };
}

/** A time rule: its hours through the week, the list it switches on, and what that list charges. */
export default async function RulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  const rule = pricing.rules().find((r) => r.id === ruleId);
  if (!rule) notFound();
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const list = pricing.priceLists().find((l) => l.id === rule.priceListId);
  const base = pricingManage.defaultList();
  const baseItems = base ? pricing.itemsFor(base.id) : [];
  const items = list ? pricing.itemsFor(list.id) : [];
  const live = rule.status === 'active' && ruleCoversInstant(rule, Date.now(), outlet.timezone);
  const overlaps = pricingManage.overlapping(rule);
  const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const minutesADay = (toMinutes(rule.endTime) - toMinutes(rule.startTime) + 1440) % 1440 || 1440;
  const all = pricing.rules();
  const priced = items
    .map((i) => ({ item: i, variant: catalogue.variantById(i.productVariantId), base: baseItems.find((b) => b.productVariantId === i.productVariantId)?.priceCents ?? null }))
    .filter((x) => x.variant)
    .sort((a, b) => a.variant!.name.localeCompare(b.variant!.name));

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={rule.name} />
      <DetailHeader
        back={{ href: '/console/pricing/rules', label: 'Time rules' }}
        title={rule.name}
        status={rule.status !== 'active' ? <StatusChip status="retired" label="Off" /> : live ? <StatusChip status="poured" label="On now" /> : <StatusChip status="sent" label="Scheduled" />}
        meta={<MetaRow items={[{ icon: IconClock, value: describeRuleWindow(rule) }, { label: 'Priority', value: String(rule.priority) }]} />}
        actions={
          <RuleActions
            rule={{ id: rule.id, name: rule.name, priceListId: rule.priceListId, daysOfWeek: rule.daysOfWeek, startTime: rule.startTime, endTime: rule.endTime, priority: rule.priority }}
            active={rule.status === 'active'}
            overlays={pricing.priceLists().filter((l) => l.kind === 'overlay' && l.status === 'active').map((l) => ({ value: l.id, label: l.name }))}
            others={all.map((r) => ({ id: r.id, name: r.name, priceListId: r.priceListId, daysOfWeek: r.daysOfWeek, startTime: r.startTime, endTime: r.endTime, priority: r.priority, status: r.status }))}
            canEdit={identity.can(actor.staffId, 'price.write')}
          />
        }
      />

      <MetricGrid columns={3}>
        <Metric label="Charges" icon={IconListDetails} value={<span className="font-sans text-title-section">{list?.name ?? 'A removed list'}</span>} detail={list ? `${items.length} prices` : 'Choose another list'} href={list ? `/console/pricing/lists/${list.id}` : undefined} />
        <Metric label="Hours a week" icon={IconClock} value={String(Math.round((minutesADay * rule.daysOfWeek.length) / 60))} detail={`${rule.daysOfWeek.length} days`} />
        <Metric label="Shares hours with" icon={IconTag} tone={overlaps.length > 0 ? 'attention' : 'default'} value={String(overlaps.length)} detail={overlaps.length > 0 ? overlaps.map((r) => r.name).join(', ') : 'No other rule'} />
      </MetricGrid>

      <Card aria-labelledby="rule-week">
        <CardHeader band level="h2" titleId="rule-week" title="Its week" subtitle="With the rules it shares hours with." />
        <CardBody className="pt-20">
          <WeekTimeline rules={[rule, ...overlaps].map((r) => ({ id: r.id, name: r.name, daysOfWeek: r.daysOfWeek, startTime: r.startTime, endTime: r.endTime, live: r.id === rule.id && live }))} />
        </CardBody>
      </Card>

      {list ? (
        <Card aria-labelledby="rule-prices">
          <CardHeader band level="h2" titleId="rule-prices" title={`What ${list.name} charges`} subtitle="Against the base price." />
          <LedgerList label="Prices">
            {priced.map(({ item, variant, base: b }) => (
              <LedgerItem key={item.id}>
                <span className="flex items-baseline justify-between gap-16">
                  <EntityLink kind="product" id={variant!.productId} className="text-ui">
                    {variant!.name}
                  </EntityLink>
                  <span className="flex items-baseline gap-16">
                    {b ? <Money value={b} currency={false} size="num-md" tone="muted" /> : null}
                    <Money value={item.priceCents} currency={false} size="num-md" tone="accent" />
                    {b ? <span className="w-72 text-right text-body-sm text-ink-subtle">saves <Money value={subtract(b, item.priceCents)} currency={false} size="num-sm" tone="subtle" /></span> : null}
                  </span>
                </span>
              </LedgerItem>
            ))}
          </LedgerList>
        </Card>
      ) : null}
    </div>
  );
}
