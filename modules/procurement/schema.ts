import 'server-only';
import { dataset } from '../_data/source';

/** Procurement owns suppliers, supplier products, purchase orders and goods receipts. */
export const procurementTables = () => {
  const d = dataset();
  return {
    suppliers: d.suppliers,
    supplierProducts: d.supplierProducts,
    purchaseOrders: d.purchaseOrders,
    purchaseOrderLines: d.purchaseOrderLines,
    receipts: d.receipts,
    receiptLines: d.receiptLines,
    goodsReceivedNotes: d.goodsReceivedNotes,
  };
};
