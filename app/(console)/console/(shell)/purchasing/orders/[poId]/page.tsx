import { formatDate, formatDateTime, plural } from '@bliss/shared/format';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Callout, DetailHeader, KeyValueList, MetaRow, Totals } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconCalendarDue, IconClock, IconTruckDelivery, IconUser } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { ORDER_STATUS } from '../../../_lib/labels';
import { businessDate } from '@bliss/shared/time';
import { orderFormData } from '../order-data';
import { OrderActions } from './order-detail';

export async function generateMetadata({ params }: { params: Promise<{ poId: string }> }): Promise<Metadata> {
  const { poId } = await params;
  const order = procurement.purchaseOrders().find((p) => p.id === poId);
  return { title: order ? `Order ${order.poNumber}` : 'Purchase order' };
}

const head = 'px-12 py-12 text-label text-ink-subtle';

/** One purchase order: what was ordered, what has come so far, and the deliveries against it. */
export default async function OrderPage({ params }: { params: Promise<{ poId: string }> }) {
  const { poId } = await params;
  const order = procurement.purchaseOrders().find((p) => p.id === poId);
  if (!order) notFound();
  const tz = identity.outlet().timezone;
  const supplier = procurement.supplierById(order.supplierId);
  const receipts = procurement.receipts().filter((r) => r.purchaseOrderId === order.id);
  const lines = procurement.purchaseOrderLines(order.id);
  const outstanding = lines.reduce((n, l) => n + Math.max(0, l.qtyOrdered - l.qtyReceived), 0);
  const title = `Order ${order.poNumber}`;

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={title} />
      <DetailHeader
        back={{ href: '/console/purchasing/orders', label: 'Orders' }}
        title={title}
        status={<StatusChip {...ORDER_STATUS[order.status]} />}
        meta={
          <MetaRow
            items={[
              { icon: IconTruckDelivery, value: supplier?.name ?? 'Supplier removed' },
              { icon: IconClock, value: `Raised ${formatDateTime(order.raisedAt, tz)}` },
              { icon: IconUser, value: identity.displayName(order.raisedBy) },
              order.expectedAt ? { icon: IconCalendarDue, value: `Expected ${formatDate(order.expectedAt, tz)}` } : null,
            ]}
          />
        }
        actions={
          <OrderActions
            orderId={order.id}
            number={order.poNumber}
            status={order.status}
            editable={
              (order.status === 'draft' || order.status === 'sent') && lines.every((l) => l.qtyReceived === 0)
                ? { ...orderFormData(), initial: { supplierId: order.supplierId, lines: lines.map((l) => ({ variantId: l.productVariantId, qty: l.qtyOrdered, unitCostCents: l.unitCostCents })), expectedAt: order.expectedAt ? businessDate(order.expectedAt, identity.outlet().timezone, '00:00') : null, notes: order.notes } }
                : null
            }
          />
        }
      />

      {order.notes ? (
        <Callout tone="info" title="Note on the order">
          {order.notes}
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Card aria-labelledby="order-lines">
          <CardHeader band level="h2" titleId="order-lines" title="Lines" subtitle={outstanding > 0 ? `${plural(lines.length, 'line')}, ${outstanding} units still to come` : plural(lines.length, 'line')} />
          <div className="scroll-x">
            <table className="w-full border-collapse">
              <caption className="sr-only">Lines on {title}</caption>
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className={`${head} pl-20 text-left`}>
                    Item
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Ordered
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Received
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Each
                  </th>
                  <th scope="col" className={`${head} pr-20 text-right`}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule last:border-b-0">
                    <td className="py-12 pl-20 pr-12 text-ui">
                      <EntityLink kind="product" id={catalogue.variantById(l.productVariantId)?.productId}>
                        {catalogue.variantById(l.productVariantId)?.name ?? 'Item no longer stocked'}
                      </EntityLink>
                    </td>
                    <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{l.qtyOrdered}</td>
                    <td className={`px-12 py-12 text-right font-mono tabular text-num-md ${l.qtyReceived === 0 ? 'text-ink-subtle' : l.qtyReceived < l.qtyOrdered ? 'text-low' : 'text-poured'}`}>{l.qtyReceived}</td>
                    <td className="px-12 py-12 text-right">
                      <Money value={l.unitCostCents} currency={false} size="num-md" tone="muted" />
                    </td>
                    <td className="py-12 pl-12 pr-20 text-right">
                      <Money value={l.lineTotalCents} currency={false} size="num-md" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-end border-t border-edge px-20 py-16 card-band">
            <Totals className="w-full max-w-totals" items={[]} total={{ label: 'Order value', value: <Money value={order.totalCents} size="num-lg" /> }} />
          </footer>
        </Card>

        <div className="flex min-w-0 flex-col gap-24">
          <Card aria-labelledby="order-deliveries">
            <CardHeader band level="h2" titleId="order-deliveries" title="Deliveries" subtitle={receipts.length > 0 ? plural(receipts.length, 'delivery', 'deliveries') : undefined} />
            {receipts.length === 0 ? (
              <CardBody className="pt-16">
                <p className="text-body-sm text-ink-muted">Nothing received against this order yet.</p>
              </CardBody>
            ) : (
              <ul className="flex flex-col">
                {receipts.map((r) => {
                  const got = procurement.receiptLines(r.id);
                  const back = got.reduce((n, x) => n + x.qtyRejected, 0);
                  return (
                    <li key={r.id} className="relative flex flex-col gap-2 border-b border-rule px-20 py-12 transition-hover last:border-b-0 hover:bg-band">
                      <Link href={`/console/purchasing/receipts/${r.id}`} className="link-stretched rounded-sm text-ui font-medium text-ink">
                        Delivery <span className="font-mono tabular">{r.grnNumber}</span>
                      </Link>
                      <span className="text-body-sm text-ink-muted">
                        {formatDateTime(r.receivedAt, tz)}, {got.reduce((n, x) => n + x.qtyReceived, 0)} in{back > 0 ? `, ${back} sent back` : ''}
                        {r.status === 'cancelled' ? ', reversed' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {supplier ? (
            <Card aria-labelledby="order-supplier">
              <CardHeader band level="h2" titleId="order-supplier" title={<EntityLink kind="supplier" id={supplier.id}>{supplier.name}</EntityLink>} subtitle="Supplier" />
              <CardBody className="pt-4">
                <KeyValueList
                  layout="inline"
                  items={[
                    { label: 'Contact', value: supplier.contactName || 'Not recorded' },
                    { label: 'Pays in', value: plural(supplier.paymentTermsDays, 'day') },
                    { label: 'Delivers in', value: plural(supplier.leadTimeDays, 'day') },
                    ...(order.approvedBy && order.approvedBy !== order.raisedBy ? [{ label: 'Approved by', value: identity.displayName(order.approvedBy) }] : []),
                  ]}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
