import { formatBps, formatDate, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBand, KeyRow, KeyRows } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Section } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconPlus, IconTrendingUp, IconTruck, IconTruckDelivery, IconWallet } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { ViewHeader } from '../../_components/workspace';
import { type CostChangeRow, CostChangesTable } from './cost-changes-table';
import { SuppliersCreate } from './suppliers-client';

export const metadata: Metadata = { title: 'Suppliers' };

const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Who supplies what, on what terms, and where their prices have moved. */
export default async function SuppliersPage() {
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'cost.read');
  const tz = identity.outlet().timezone;
  const orders = procurement.purchaseOrders();
  const open = orders.filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received');
  const suppliers = [...procurement.suppliers()].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1));
  const changes: CostChangeRow[] = procurement.costChanges().map((c) => ({
    id: c.supplierProduct.id,
    item: catalogue.variantById(c.supplierProduct.productVariantId)?.name ?? '',
    supplier: procurement.supplierById(c.supplierProduct.supplierId)?.name ?? '',
    supplierId: c.supplierProduct.supplierId,
    sku: c.supplierProduct.supplierSku,
    from: c.from,
    to: c.to,
    changeBps: c.changeBps,
    at: c.at,
  }));
  const rises = changes.filter((c) => c.changeBps > 0);

  return (
    <>
      <ViewHeader
        page="/console/purchasing/suppliers"
        actions={
          canEdit ? (
            <ButtonLink href="/console/purchasing/suppliers?new=1" variant="create" icon={IconPlus}>
              Add a supplier
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-32">
        <MetricGrid>
          <Metric label="Suppliers" icon={IconTruck} value={String(suppliers.filter((s) => s.status === 'active').length)} detail={suppliers.some((s) => s.status === 'archived') ? `${suppliers.filter((s) => s.status === 'archived').length} no longer used` : 'All in use'} />
          <Metric label="Open orders" icon={IconTruckDelivery} href="/console/purchasing/orders" value={String(open.length)} detail={open.length > 0 ? formatKes(sum(open.map((o) => o.totalCents)), { decimals: 'whole' }) + ' on its way' : 'Nothing on its way'} />
          <Metric label="Costs gone up" icon={IconTrendingUp} tone={rises.length > 0 ? 'attention' : 'default'} value={String(rises.length)} detail={rises.length > 0 ? `Largest ${formatBps(Math.max(...rises.map((c) => c.changeBps)), { signed: true })}` : 'No rises on the last delivery'} />
          <Metric label="Spent with them" icon={IconWallet} value={<Money value={sum(orders.filter((o) => o.status !== 'cancelled').map((o) => o.totalCents))} size="num-kpi" decimals="whole" />} detail="Every order raised" />
        </MetricGrid>

        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
          {suppliers.map((s) => {
            const own = orders.filter((o) => o.supplierId === s.id && o.status !== 'cancelled');
            const openHere = own.filter((o) => open.includes(o));
            const last = own[0];
            return (
              <Card key={s.id} as="article" interactive className="group h-full" tone={openHere.length > 0 ? 'accent' : undefined}>
                <CardBand
                  eyebrow={s.status === 'archived' ? 'Not used' : `${procurement.supplierProducts(s.id).length} items`}
                  status={s.status === 'archived' ? <StatusChip status="retired" label="Not used" /> : openHere.length > 0 ? <StatusChip status="sent" label={`${openHere.length} open`} /> : null}
                  title={s.name}
                  subtitle={[s.contactName, s.phone].filter(Boolean).join(', ') || 'No contact set'}
                  href={`/console/purchasing/suppliers/${s.id}`}
                />
                <KeyRows>
                  <KeyRow label="Delivers in">{plural(s.leadTimeDays, 'day')}</KeyRow>
                  <KeyRow label="Delivers on">{s.deliveryDays && s.deliveryDays.length > 0 ? s.deliveryDays.map((d) => DAY[d]).join(', ') : 'Any day'}</KeyRow>
                  <KeyRow label="Pays in">{plural(s.paymentTermsDays, 'day')}</KeyRow>
                  <KeyRow label="Last order">{last ? `PO ${last.poNumber}, ${formatDate(last.raisedAt, tz)}` : 'None yet'}</KeyRow>
                  <KeyRow label="Ordered in all">
                    <Money value={sum(own.map((o) => o.totalCents))} currency={false} size="num-md" decimals="whole" />
                  </KeyRow>
                </KeyRows>
              </Card>
            );
          })}
        </div>

        <Section
          id="cost-changes"
          title="Cost changes"
          description={changes.length > 0 ? `Largest rise ${formatBps(Math.max(...changes.map((c) => c.changeBps)), { signed: true })}. Check the sell prices still carry their margin.` : 'What each supplier charged on the last delivery against the one before.'}
        >
          <CostChangesTable rows={changes} timezone={tz} />
        </Section>
      </div>
      <SuppliersCreate canEdit={canEdit} />
    </>
  );
}
