import { formatDateTime, formatIsoDate, formatTime, plural } from '@bliss/shared/format';
import { ZERO, abs, compare, formatKes, isNegative, sum } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconCash, IconClock, IconDeviceDesktop, IconReceipt, IconScale, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as settlement from '@/modules/settlement/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { TENDER_LABEL } from '../../../_lib/labels';
import { DrawerActions } from './drawer-actions';

export async function generateMetadata({ params }: { params: Promise<{ drawerId: string }> }): Promise<Metadata> {
  const { drawerId } = await params;
  const d = settlement.drawerView(drawerId);
  return { title: d ? `Drawer, ${formatIsoDate(d.businessDate)}` : 'Drawer' };
}

const MOVEMENT = { opening_float: 'Float counted in', drop_to_safe: 'Dropped to the safe', payout: 'Paid out', adjustment: 'Adjusted' } as const;

/**
 * One drawer session: the float, the cash that came in on each bill, what left it, the count, and
 * the variance. The expected figure stays withheld until the count is committed. docs/01 R7.
 */
export default async function DrawerPage({ params }: { params: Promise<{ drawerId: string }> }) {
  const { drawerId } = await params;
  const d = settlement.drawerView(drawerId);
  if (!d) notFound();
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const device = identity.devices().find((x) => x.id === d.deviceId);
  const bills = settlement.billsInDrawer(d.id).sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));
  const tenders = settlement.tendersByBill();
  const cashIn = sum(settlement.cashTakenIn(d.id));
  const movements = settlement.cashMovementsFor(d.id);
  const out = sum(movements.filter((m) => m.kind === 'drop_to_safe' || m.kind === 'payout').map((m) => m.amountCents));
  const over = d.stage === 'closed' && d.varianceCents !== null && compare(abs(d.varianceCents), outlet.drawerVarianceThresholdCents) > 0;
  const title = `${device?.label ?? 'Drawer'}, ${formatIsoDate(d.businessDate)}`;

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/trade/drawers', label: 'Drawers' }}
        title={title}
        status={
          d.status !== 'closed' ? (
            <StatusChip status={d.status === 'counting' ? 'counting' : 'open'} />
          ) : d.reviewedAt ? (
            <StatusChip status="resolved" label="Reviewed" />
          ) : over ? (
            <StatusChip status="unresolved" label="To review" />
          ) : (
            <StatusChip status="settled" label="Closed" />
          )
        }
        meta={
          <MetaRow
            items={[
              {
                icon: IconDeviceDesktop,
                value: device ? (
                  <EntityLink kind="device" id={device.id} muted>
                    {device.label}
                  </EntityLink>
                ) : (
                  'A device'
                ),
              },
              {
                icon: IconUser,
                value: (
                  <EntityLink kind="staff" id={d.openedBy} muted>
                    Opened by {identity.displayName(d.openedBy)}
                  </EntityLink>
                ),
              },
              { icon: IconClock, value: `${formatTime(d.openedAt, tz)}${d.closedAt ? ` to ${formatTime(d.closedAt, tz)}` : ''}` },
              d.closedBy
                ? {
                    value: (
                      <EntityLink kind="staff" id={d.closedBy} muted>
                        Closed by {identity.displayName(d.closedBy)}
                      </EntityLink>
                    ),
                  }
                : null,
            ]}
          />
        }
        actions={<DrawerActions sessionId={d.id} reviewable={d.stage === 'closed' && !d.reviewedAt && identity.can(actor.staffId, 'drawer.close')} title={title} />}
      />

      {d.reviewedAt ? (
        <Callout tone="poured" title={`Reviewed by ${identity.displayName(d.reviewedBy)}, ${formatDateTime(d.reviewedAt, tz)}`}>
          {d.reviewNote}
        </Callout>
      ) : over ? (
        <Callout tone="stop" title="The count is outside the threshold">
          {d.varianceReason ? `The cashier said: ${d.varianceReason.replace(/\.$/, '')}.` : 'No reason was given.'} Review it once you have looked into it.
        </Callout>
      ) : null}

      <MetricGrid>
        <Metric label="Float" icon={IconCash} value={<Money value={d.openingFloatCents} size="num-kpi" decimals="whole" />} detail="Counted in when it opened" />
        <Metric
          label="Cash taken"
          icon={IconReceipt}
          tone="poured"
          value={<Money value={cashIn} size="num-kpi" decimals="whole" />}
          detail={plural(bills.filter((b) => (tenders.get(b.id) ?? []).some((t) => t.kind === 'cash')).length, 'cash bill')}
        />
        <Metric label="Taken out" icon={IconCash} value={<Money value={out} size="num-kpi" decimals="whole" />} detail="Drops to the safe and refunds" />
        <Metric
          label="Variance"
          icon={IconScale}
          tone={over ? 'stop' : 'default'}
          value={d.stage === 'closed' && d.varianceCents !== null ? <Money value={d.varianceCents} size="num-kpi" /> : 'Withheld'}
          detail={
            d.stage === 'closed' && d.countedCashCents !== null && d.expectedCashCents !== null
              ? `Counted ${formatKes(d.countedCashCents, { decimals: 'whole' })} of ${formatKes(d.expectedCashCents, { decimals: 'whole' })} expected`
              : 'Shown once the count is committed'
          }
        />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card aria-labelledby="drawer-bills">
          <CardHeader band level="h2" titleId="drawer-bills" title="Bills on this drawer" subtitle="Settled on its device while it was open. Cash went into the drawer." />
          {bills.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="No bills yet" body="Bills settled at this counter while the drawer is open appear here." />
            </div>
          ) : (
            <LedgerList className="mx-20 my-16" label="Bills">
              {bills.map((b) => {
                const own = tenders.get(b.id) ?? [];
                const cash = sum(own.filter((t) => t.kind === 'cash' && !isNegative(t.amountCents)).map((t) => t.amountCents));
                return (
                  <LedgerItem key={b.id} tone={b.status === 'voided' ? 'stop' : undefined}>
                    <span className="flex items-baseline justify-between gap-16">
                      <span className="min-w-0">
                        <EntityLink kind="bill" id={b.id} className="text-ui">
                          Bill {b.billNumber}
                        </EntityLink>
                        <span className="block text-body-sm text-ink-subtle">
                          {formatTime(b.settledAt ?? 0, tz)}, {[...new Set(own.filter((t) => !isNegative(t.amountCents)).map((t) => TENDER_LABEL[t.kind]))].join(' and ')}
                          {compare(cash, ZERO) > 0 && own.some((t) => t.kind !== 'cash') ? `, ${formatKes(cash, { decimals: 'whole' })} in cash` : ''}
                          {b.status === 'voided' ? ', voided' : b.status !== 'settled' ? `, ${b.status.replace('_', ' ')}` : ''}
                        </span>
                      </span>
                      <Money value={b.totalCents} size="num-md" />
                    </span>
                  </LedgerItem>
                );
              })}
            </LedgerList>
          )}
        </Card>

        <Card aria-labelledby="drawer-cash">
          <CardHeader band level="h2" titleId="drawer-cash" title="Cash in and out" subtitle="Everything but the sales." />
          {movements.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="Nothing but sales" body="No float, drop or refund was recorded against this drawer." />
            </div>
          ) : (
            <LedgerList className="mx-20 my-16" label="Cash movements">
              {movements.map((m) => (
                <LedgerItem key={m.id} tone={m.kind === 'opening_float' ? 'poured' : m.kind === 'payout' ? 'stop' : undefined}>
                  <span className="flex items-baseline justify-between gap-12">
                    <span className="text-ui text-ink">{MOVEMENT[m.kind]}</span>
                    <Money value={m.amountCents} size="num-md" />
                  </span>
                  <span className="block text-body-sm text-ink-subtle">
                    {formatTime(m.occurredAt, tz)}, {identity.displayName(m.createdBy)}
                    {m.reason ? `. ${m.reason}` : ''}
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
