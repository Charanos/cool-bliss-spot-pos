import { formatBps, formatDate, plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as procurement from '@/modules/procurement/service';
import { CostChangesTable, type CostChangeRow } from './cost-changes-table';

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
    <>
      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-3">
        {procurement.suppliers().map((s) => {
          const own = orders.filter((o) => o.supplierId === s.id && o.status !== 'cancelled');
          const last = own[0];
          const products = procurement.supplierProducts(s.id).length;
          return (
            <RevealSection key={s.id} className="flex flex-col gap-12 rounded-md border border-hairline bg-raised p-20 shadow-raised">
              <div>
                <h2 className="text-subtitle text-ink">{s.name}</h2>
                <p className="text-body-sm text-ink-muted">{s.contactName}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-16 gap-y-8 text-body-sm">
                <dt className="text-ink-subtle">Delivers in</dt>
                <dd className="text-right font-mono tabular text-num-sm text-ink">{plural(s.leadTimeDays, 'day')}</dd>
                <dt className="text-ink-subtle">Pays in</dt>
                <dd className="text-right font-mono tabular text-num-sm text-ink">{plural(s.paymentTermsDays, 'day')}</dd>
                <dt className="text-ink-subtle">Minimum order</dt>
                <dd className="text-right font-mono tabular text-num-sm text-ink">{formatKes(s.minOrderCents, { decimals: 'whole' })}</dd>
                <dt className="text-ink-subtle">Items supplied</dt>
                <dd className="text-right font-mono tabular text-num-sm text-ink">{products}</dd>
                <dt className="text-ink-subtle">Ordered in 56 days</dt>
                <dd className="text-right">
                  <Money value={sum(own.map((o) => o.totalCents))} currency={false} decimals="whole" size="num-sm" />
                </dd>
              </dl>
              <p className="mt-auto border-t border-rule pt-12 text-body-sm text-ink-muted">{last ? `Last order PO ${last.poNumber} on ${formatDate(last.raisedAt, tz)}` : 'No orders yet'}</p>
            </RevealSection>
          );
        })}
      </div>

      <RevealSection className="mt-40" aria-labelledby="cost-changes">
        <div className="mb-12 flex flex-wrap items-baseline justify-between gap-16">
          <h2 id="cost-changes" className="text-subtitle text-ink">
            Cost changes
          </h2>
          <p className="text-body-sm text-ink-muted">
            {changes.length > 0 ? `Largest rise ${formatBps(Math.max(...changes.map((c) => c.changeBps)), { signed: true })}. Check prices still carry their margin.` : ''}
          </p>
        </div>
        <CostChangesTable rows={changes} timezone={tz} />
      </RevealSection>
    </>
  );
}
