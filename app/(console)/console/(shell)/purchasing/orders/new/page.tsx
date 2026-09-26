import { DetailHeader } from '@bliss/ui/components/console/section';
import type { Metadata } from 'next';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { orderFormData } from '../order-data';
import { NewOrder } from './new-order';

export const metadata: Metadata = { title: 'New order' };

/** Raise an order by hand, to any supplier, for anything stocked. Reorder suggestions raise them too. */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { suppliers, stock } = orderFormData();
  const supplier = suppliers.find((s) => s.id === params.supplier) ?? suppliers[0];
  const item = params.item ? stock.find((s) => s.id === params.item) : null;
  const carried = supplier?.items.find((i) => i.variantId === item?.id);
  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label="New order" />
      <DetailHeader back={{ href: '/console/purchasing/orders', label: 'Orders' }} title="New order" meta={<span className="text-body-sm text-ink-muted">It goes out as sent. Bliss does not contact the supplier; send it as you usually do.</span>} />
      <NewOrder suppliers={suppliers} stock={stock} initial={{ supplierId: supplier?.id ?? '', lines: item ? [{ variantId: item.id, qty: carried?.packSize ?? 1, unitCostCents: carried?.costCents ?? item.avgCostCents }] : [], expectedAt: null, notes: null }} />
    </div>
  );
}
