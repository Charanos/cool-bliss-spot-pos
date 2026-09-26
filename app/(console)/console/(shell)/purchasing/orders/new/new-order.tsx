'use client';

import { Card, CardBody } from '@bliss/ui/components/console/card';
import { useRouter } from 'next/navigation';
import { raisePurchaseOrder } from '../../../_actions/purchasing';
import { type OrderDraftLine, OrderForm, type OrderStockItem, type OrderSupplier } from '../../_parts/order-form';

export function NewOrder({ suppliers, stock, initial }: { suppliers: OrderSupplier[]; stock: OrderStockItem[]; initial: { supplierId: string; lines: OrderDraftLine[]; expectedAt: string | null; notes: string | null } }) {
  const router = useRouter();
  return (
    <Card>
      <CardBody className="pt-20">
        <OrderForm
          suppliers={suppliers}
          stock={stock}
          initial={initial}
          submitLabel="Raise the order"
          onCancel={() => router.push('/console/purchasing/orders')}
          onSubmit={async (v) => {
            const result = await raisePurchaseOrder({ supplierId: v.supplierId, lines: v.lines, expectedAt: v.expectedAt, notes: v.notes, requestId: v.requestId });
            if (result.ok) router.push(`/console/purchasing/orders/${result.id}`);
            return result;
          }}
        />
      </CardBody>
    </Card>
  );
}
