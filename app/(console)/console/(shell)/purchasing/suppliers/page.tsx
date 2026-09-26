import { formatBps, formatDate, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Section } from '@bliss/ui/components/console/section';
import { StatusChip } from '@bliss/ui/components/status';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { CostChangesTable, type CostChangeRow } from './cost-changes-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Suppliers' };

/** Who supplies what, on what terms, and where their prices have moved. */
export default function SuppliersPage() {
  const tz = identity.outlet().timezone;
  const orders = procurement.purchaseOrders();
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

  return (
    <div className="flex flex-col gap-40">
      <ViewHeader page="/console/purchasing/suppliers" />
      <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
        {procurement.suppliers().map((s) => {
          const own = orders.filter((o) => o.supplierId === s.id && o.status !== 'cancelled');
          const last = own[0];
          return (
            <Card key={s.id} as="article" className="h-full">
              <CardHeader band title={s.name} subtitle={s.contactName} meta={s.status === 'archived' ? <StatusChip status="retired" label="Archived" /> : null} />
              <CardStats>
                <Stat label="Delivers in">{plural(s.leadTimeDays, 'day')}</Stat>
                <Stat label="Pays in">{plural(s.paymentTermsDays, 'day')}</Stat>
                <Stat label="Minimum order">{formatKes(s.minOrderCents, { decimals: 'whole' })}</Stat>
                <Stat label="Items supplied">{procurement.supplierProducts(s.id).length}</Stat>
              </CardStats>
              <CardFooter>
                <span className="text-body-sm text-ink-muted">{last ? `Last order ${last.poNumber}, ${formatDate(last.raisedAt, tz)}` : 'No orders yet'}</span>
                <Money value={sum(own.map((o) => o.totalCents))} size="num-md" decimals="whole" />
              </CardFooter>
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
  );
}
