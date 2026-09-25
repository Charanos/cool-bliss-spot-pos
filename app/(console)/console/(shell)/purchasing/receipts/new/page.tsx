import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@bliss/ui/components/console/shell';
import { StatusChip } from '@bliss/ui/components/status';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as catalogue from '@/modules/catalogue/service';
import { GrnIntakeForm } from './grn-intake-form';

export default async function NewGoodsReceivedNotePage(props: { searchParams: Promise<{ poId?: string }> }) {
  const actor = identity.staffList()[0];
  const searchParams = await props.searchParams;
  
  const stores = inventory.locations().filter((l) => l.isDefaultReceipt || l.kind === 'store');
  const suppliers = procurement.suppliers().map(s => ({ id: s.id, name: s.name }));
  const availableVariants = catalogue.stockVariants().length > 0 ? catalogue.stockVariants() : catalogue.variants();
  const variants = availableVariants.map((v) => {
    const product = catalogue.productById(v.productId);
    const pName = product ? product.name.trim() : '';
    const vName = v.name.trim();
    const name = pName && !vName.toLowerCase().startsWith(pName.toLowerCase())
      ? `${pName} ${vName}`
      : vName;

    return {
      id: v.id,
      name,
      supplierIds: procurement.supplierProducts().filter((sp) => sp.productVariantId === v.id).map((sp) => sp.supplierId),
      unitCostCents: inventory.averageCost(v.id) as unknown as number,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  
  let prefillOrder = null;
  if (searchParams.poId) {
    const order = procurement.purchaseOrders().find(p => p.id === searchParams.poId);
    if (order) {
      const lines = procurement.purchaseOrderLines(order.id);
      prefillOrder = {
        id: order.id,
        poNumber: order.poNumber,
        supplierId: order.supplierId,
        lines: lines.map(l => ({
          id: l.id,
          purchaseOrderLineId: l.id,
          variantId: l.productVariantId,
          qtyExpected: l.qtyOrdered - l.qtyReceived,
          qtyReceived: l.qtyOrdered - l.qtyReceived,
          unitCostCents: l.unitCostCents,
        }))
      };
    }
  }

  return (
    <>
      <div className="mb-12 mt-4">
        <PageHeader 
          title="Receive Goods" 
          eyebrow="Inventory Intake"
          badge={prefillOrder ? <StatusChip status="open" label={`Against PO #${prefillOrder.poNumber}`} /> : null}
          description="Log intake from suppliers, verify against delivery notes, and record exact batch numbers for FEFO compliance."
        />
      </div>
      
      <div className="mx-auto max-w-[1000px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Suspense fallback={<div className="animate-pulse h-96 bg-raised rounded-lg border border-hairline shadow-raised" />}>
          <GrnIntakeForm 
            actorId={actor?.id ?? ''}
            stores={stores} 
            suppliers={suppliers}
            variants={variants}
            prefillOrder={prefillOrder}
          />
        </Suspense>
      </div>
    </>
  );
}
