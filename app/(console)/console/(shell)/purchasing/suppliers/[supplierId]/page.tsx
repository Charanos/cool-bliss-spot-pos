import { formatBps, formatDate, plural } from '@bliss/shared/format';
import { formatKes, percentChangeBps, sum } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, KeyValueList, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { Sparkline } from '@bliss/ui/components/console/sparkline';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconMail, IconPackage, IconPhone, IconTruckDelivery, IconUser, IconWallet } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { CarriedItemControls, SupplierActions } from '../suppliers-client';

export async function generateMetadata({ params }: { params: Promise<{ supplierId: string }> }): Promise<Metadata> {
  const { supplierId } = await params;
  return { title: procurement.supplierById(supplierId)?.name ?? 'Supplier' };
}

const DAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PO_STATUS = { draft: 'draft', sent: 'sent', partially_received: 'partial', received: 'received', cancelled: 'cancelled' } as const;
const PO_WORD: Record<string, string | undefined> = { draft: 'Needs approval' };

/** A supplier: how to reach them, their terms, what they carry at what cost, and every order and delivery. */
export default async function SupplierPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const supplier = procurement.supplierById(supplierId);
  if (!supplier) notFound();
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'cost.read');
  const tz = identity.outlet().timezone;
  const carried = procurement.supplierProducts(supplier.id);
  const orders = procurement.purchaseOrders().filter((o) => o.supplierId === supplier.id);
  const open = orders.filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received');
  const receipts = procurement.receipts().filter((r) => r.supplierId === supplier.id);
  const carriedIds = new Set(carried.map((c) => c.productVariantId));
  const addable = catalogue
    .stockVariants()
    .filter((v) => !carriedIds.has(v.id))
    .map((v) => ({ value: v.id, label: v.name }));

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={supplier.name} />
      <DetailHeader
        back={{ href: '/console/purchasing/suppliers', label: 'Suppliers' }}
        title={supplier.name}
        status={<StatusChip status={supplier.status === 'active' ? 'active' : 'retired'} label={supplier.status === 'active' ? 'In use' : 'Not used'} />}
        meta={
          <MetaRow
            items={[
              supplier.contactName ? { icon: IconUser, value: supplier.contactName } : null,
              supplier.phone ? { icon: IconPhone, value: <a href={`tel:${supplier.phone.replace(/\s/g, '')}`} className="rounded-sm text-accent-text hover:text-ink">{supplier.phone}</a> } : null,
              supplier.email ? { icon: IconMail, value: <a href={`mailto:${supplier.email}`} className="rounded-sm text-accent-text hover:text-ink">{supplier.email}</a> } : null,
            ]}
          />
        }
        actions={
          <SupplierActions
            supplier={{ id: supplier.id, name: supplier.name, contactName: supplier.contactName || null, phone: supplier.phone ?? null, email: supplier.email ?? null, paymentTermsDays: supplier.paymentTermsDays, leadTimeDays: supplier.leadTimeDays, minOrderCents: supplier.minOrderCents, deliveryDays: supplier.deliveryDays ?? [], notes: supplier.notes ?? null }}
            active={supplier.status === 'active'}
            canEdit={canEdit}
          />
        }
      />

      <MetricGrid>
        <Metric label="Items they carry" icon={IconPackage} value={String(carried.length)} detail="With their cost and pack" />
        <Metric label="Open orders" icon={IconTruckDelivery} tone={open.length > 0 ? 'info' : 'default'} value={String(open.length)} detail={open.length > 0 ? `${formatKes(sum(open.map((o) => o.totalCents)), { decimals: 'whole' })} on its way` : 'Nothing on its way'} />
        <Metric label="Deliveries" icon={IconTruckDelivery} value={String(receipts.length)} detail={receipts[0] ? `Last on ${formatDate(receipts[0].receivedAt, tz)}` : 'None yet'} />
        <Metric label="Spent with them" icon={IconWallet} value={<Money value={sum(orders.filter((o) => o.status !== 'cancelled').map((o) => o.totalCents))} size="num-kpi" decimals="whole" />} detail={plural(orders.filter((o) => o.status !== 'cancelled').length, 'order')} />
      </MetricGrid>

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card aria-labelledby="supplier-items">
          <CardHeader band level="h2" titleId="supplier-items" title="What they carry" subtitle="Their code, the pack, the cost of one unit, and how that cost has moved." actions={<CarriedItemControls supplierId={supplier.id} target={null} items={addable} canEdit={canEdit && supplier.status === 'active'} mode="add" />} />
          {carried.length === 0 ? (
            <div className="px-20 py-20">
              <EmptyState title="No items yet" body="Add the items they carry, so orders fill in their cost and pack." />
            </div>
          ) : (
            <LedgerList label="Items">
              {carried.map((sp) => {
                const variant = catalogue.variantById(sp.productVariantId);
                const history = [...sp.history].sort((a, b) => a.at - b.at);
                const first = history[0];
                const moved = first && history.length > 1 ? percentChangeBps(first.costCents, sp.lastCostCents) : 0;
                return (
                  <LedgerItem key={sp.id}>
                    <span className="grid grid-cols-1 items-center gap-8 desktop:grid-cols-[minmax(0,2fr)_96px_120px_120px_40px]">
                      <span className="min-w-0">
                        <EntityLink kind="product" id={variant?.productId} className="text-ui">
                          {variant?.name ?? 'Item no longer stocked'}
                        </EntityLink>
                        <span className="block text-body-sm text-ink-subtle">
                          Pack of {sp.packSize}
                          {sp.supplierSku ? `, their code ${sp.supplierSku}` : ''}
                        </span>
                      </span>
                      {history.length > 1 ? <Sparkline variant="line" values={history.map((h) => Number(h.costCents))} label="Cost over its deliveries" /> : <span />}
                      <span className={moved > 0 ? 'text-right text-body-sm text-attention' : 'text-right text-body-sm text-ink-subtle'}>{moved !== 0 ? formatBps(moved, { signed: true }) : 'Steady'}</span>
                      <Money value={sp.lastCostCents} size="num-md" className="justify-end" />
                      <CarriedItemControls supplierId={supplier.id} target={{ variantId: sp.productVariantId, name: variant?.name ?? '', supplierSku: sp.supplierSku || null, packSize: sp.packSize, costCents: sp.lastCostCents }} items={[]} canEdit={canEdit} mode="row" />
                    </span>
                  </LedgerItem>
                );
              })}
            </LedgerList>
          )}
        </Card>

        <div className="flex flex-col gap-24">
          <Card aria-labelledby="supplier-terms">
            <CardHeader band level="h2" titleId="supplier-terms" title="Terms" />
            <div className="px-20 py-16">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Delivers in', value: plural(supplier.leadTimeDays, 'day') },
                  { label: 'Delivers on', value: supplier.deliveryDays && supplier.deliveryDays.length > 0 ? supplier.deliveryDays.map((d) => DAY[d]).join(', ') : 'Any day' },
                  { label: 'Pays in', value: plural(supplier.paymentTermsDays, 'day') },
                  { label: 'Minimum order', value: formatKes(supplier.minOrderCents, { decimals: 'whole' }) },
                  ...(supplier.notes ? [{ label: 'Notes', value: supplier.notes }] : []),
                ]}
              />
            </div>
          </Card>

          <Card aria-labelledby="supplier-orders">
            <CardHeader band level="h2" titleId="supplier-orders" title="Orders and deliveries" subtitle="Newest first." />
            {orders.length === 0 && receipts.length === 0 ? (
              <div className="px-20 py-16 text-body-sm text-ink-muted">Nothing ordered or delivered yet.</div>
            ) : (
              <LedgerList label="Orders and deliveries">
                {[...orders.map((o) => ({ kind: 'order' as const, at: o.raisedAt, o })), ...receipts.map((r) => ({ kind: 'receipt' as const, at: r.receivedAt, r }))]
                  .sort((a, b) => b.at - a.at)
                  .slice(0, 12)
                  .map((x) =>
                    x.kind === 'order' ? (
                      <LedgerItem key={x.o.id} tone={open.includes(x.o) ? 'low' : undefined}>
                        <span className="flex items-center justify-between gap-12">
                          <EntityLink kind="order" id={x.o.id} className="text-ui">
                            Order {x.o.poNumber}
                          </EntityLink>
                          <StatusChip status={PO_STATUS[x.o.status]} label={PO_WORD[x.o.status]} />
                        </span>
                        <span className="flex items-center justify-between text-body-sm text-ink-subtle">
                          {formatDate(x.o.raisedAt, tz)}
                          <Money value={x.o.totalCents} size="num-sm" tone="subtle" decimals="whole" />
                        </span>
                      </LedgerItem>
                    ) : (
                      <LedgerItem key={x.r.id} tone="poured">
                        <span className="flex items-center justify-between gap-12">
                          <EntityLink kind="receipt" id={x.r.id} className="text-ui">
                            Delivery {x.r.grnNumber}
                          </EntityLink>
                          <span className="text-body-sm text-ink-subtle">{formatDate(x.r.receivedAt, tz)}</span>
                        </span>
                      </LedgerItem>
                    ),
                  )}
              </LedgerList>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
