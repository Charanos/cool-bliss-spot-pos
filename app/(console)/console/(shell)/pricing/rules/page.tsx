import { plural } from '@bliss/shared/format';
import { describeRuleWindow, ruleCoversInstant } from '@bliss/shared/pricing';
import { ActionPill } from '@bliss/ui/components/console/action-pill';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { StatusChip } from '@bliss/ui/components/status';
import { IconCalendarWeek, IconClock, IconPlayerPlay, IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import { EntityLink } from '../../_components/entity-link';
import { ViewHeader } from '../../_components/workspace';
import { WeekTimeline } from '../_parts/week-timeline';
import { RulesCreate } from './rules-client';

export const metadata: Metadata = { title: 'Time rules' };

/**
 * Time rules switch a price list on for a window. Windows are half open: a rule of 17:00 to 19:00
 * covers 18:59:59 and not 19:00:00, and a window past midnight belongs to the day it started.
 */
export default async function RulesPage() {
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'price.write');
  const outlet = identity.outlet();
  const now = Date.now();
  const lists = pricing.priceLists();
  const rules = [...pricing.rules()].sort((a, b) => (a.status === b.status ? b.priority - a.priority : a.status === 'active' ? -1 : 1));
  const active = rules.filter((r) => r.status === 'active');
  const live = active.filter((r) => ruleCoversInstant(r, now, outlet.timezone));
  const overlays = lists.filter((l) => l.kind === 'overlay' && l.status === 'active').map((l) => ({ value: l.id, label: l.name }));
  const drafts = rules.map((r) => ({ id: r.id, name: r.name, priceListId: r.priceListId, daysOfWeek: r.daysOfWeek, startTime: r.startTime, endTime: r.endTime, priority: r.priority, status: r.status }));

  return (
    <>
      <ViewHeader
        page="/console/pricing/rules"
        actions={
          canEdit ? (
            <ButtonLink href="/console/pricing/rules?new=1" variant="create" icon={IconPlus}>
              Add a time rule
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-32">
        {live.length > 0 ? (
          <Callout size="hero" tone="poured" icon={<IconPlayerPlay size={22} stroke={1.5} />} title={`${live.map((r) => r.name).join(' and ')} ${live.length === 1 ? 'is' : 'are'} on now`} action={<ActionPill href={`/console/pricing/lists/${live[0]!.priceListId}`}>See its prices</ActionPill>}>
            The floor is charging {live.map((r) => lists.find((l) => l.id === r.priceListId)?.name).join(' and ')} until {live[0]!.endTime}.
          </Callout>
        ) : null}

        <MetricGrid columns={3}>
          <Metric label="Rules on" icon={IconClock} value={String(active.length)} detail={rules.length > active.length ? `${rules.length - active.length} switched off` : 'None switched off'} />
          <Metric label="On now" icon={IconPlayerPlay} tone={live.length > 0 ? 'poured' : 'default'} value={String(live.length)} detail={live.length > 0 ? live.map((r) => r.name).join(', ') : 'Base prices right now'} />
          <Metric label="Overlay lists" icon={IconCalendarWeek} href="/console/pricing/lists" value={String(overlays.length)} detail="Lists a rule can switch on" />
        </MetricGrid>

        {rules.length === 0 ? (
          <EmptyState title="No time rules" body="Every item sells at its base price all day. A rule is how a happy hour list comes on by itself." />
        ) : (
          <>
            <Card aria-labelledby="rules-week">
              <CardHeader band level="h2" titleId="rules-week" title="The week" subtitle="Each business day from 06:00 to 06:00. A ringed bar is on now." icon={IconCalendarWeek} />
              <CardBody className="pt-20">
                <WeekTimeline rules={active.map((r) => ({ id: r.id, name: r.name, daysOfWeek: r.daysOfWeek, startTime: r.startTime, endTime: r.endTime, live: live.includes(r) }))} />
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
              {rules.map((r) => {
                const list = lists.find((l) => l.id === r.priceListId);
                const on = live.includes(r);
                return (
                  <Card key={r.id} as="article" interactive tone={on ? 'poured' : undefined} className="group h-full">
                    <CardHeader
                      band
                      title={r.name}
                      href={`/console/pricing/rules/${r.id}`}
                      subtitle={<span className="font-mono tabular">{describeRuleWindow(r)}</span>}
                      meta={r.status !== 'active' ? <StatusChip status="retired" label="Off" /> : on ? <StatusChip status="poured" label="On now" /> : <StatusChip status="sent" label="Scheduled" />}
                    />
                    <CardStats columns={2}>
                      <Stat label="Charges">
                        {list ? (
                          <EntityLink kind="priceList" id={list.id}>
                            {list.name}
                          </EntityLink>
                        ) : (
                          'A removed list'
                        )}
                      </Stat>
                      <Stat label="Priority">{r.priority}</Stat>
                    </CardStats>
                    <CardFooter>
                      <span className="text-body-sm text-ink-muted">{list ? plural(pricing.itemsFor(list.id).length, 'price') : 'No prices'}</span>
                      <span className="text-body-sm text-ink-subtle">{r.crossesMidnight ? 'Runs past midnight' : 'Same day'}</span>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
      <RulesCreate canEdit={canEdit} overlays={overlays} others={drafts} />
    </>
  );
}
