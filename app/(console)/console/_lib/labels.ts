import type { PurchaseOrderStatus } from '@bliss/db/seed/types';
import type { BillScope, TenderKind } from '@bliss/shared/domain';
import type { StatusKey } from '@bliss/ui/components/status';

/** Words for stored enums, in one place so every Console view says the same thing. docs/08. */

export const TENDER_LABEL: Record<TenderKind, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  card: 'Card',
  account: 'Account',
  comp: 'Comp',
};

export const SCOPE_LABEL: Record<BillScope, string> = {
  tab: 'Whole tab',
  seat: 'By seat',
  even_split: 'Even split',
  quick_sale: 'Quick sale',
};

const ACTION_LABEL: Record<string, string> = {
  'line.voided': 'Line voided',
  'line.moved': 'Line moved to another seat',
  'tab.moved': 'Tab moved to another table',
  'tab.handover': 'Tab handed over',
  'hold.placed': 'Put on hold',
  'hold.released': 'Taken off hold',
  'stock.written_off': 'Stock written off',
  'count.committed': 'Count committed',
  'count.cancelled': 'Count cancelled',
  'drawer.closed': 'Drawer closed',
  'price.changed': 'Price changed',
  'device.enrolled': 'Device registered',
  'device.revoked': 'Device withdrawn',
  'sync.dead_letter_resolved': 'Unsent order resolved',
  'product.stock_settings': 'Stock settings changed',
  'staff.role_changed': 'Role changed',
  'staff.suspended': 'Access suspended',
  'staff.reinstated': 'Access reinstated',
  'staff.left': 'Marked as left',
  'role.permission_changed': 'Permission changed',
  'purchase_order.raised': 'Purchase order raised',
  'purchase_order.approved': 'Purchase order approved',
  'purchase_order.cancelled': 'Purchase order cancelled',
  'goods_receipt.posted': 'Delivery received',
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export const ORDER_STATUS: Record<PurchaseOrderStatus, { status: StatusKey; label?: string }> = {
  draft: { status: 'draft', label: 'Needs approval' },
  sent: { status: 'sent' },
  partially_received: { status: 'partial' },
  received: { status: 'received' },
  cancelled: { status: 'cancelled' },
};
