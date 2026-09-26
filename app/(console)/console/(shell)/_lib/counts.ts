import 'server-only';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as pricing from '@/modules/pricing/service';
import * as procurement from '@/modules/procurement/service';
import * as sync from '@/modules/sync/service';
import * as trade from '@/modules/trade/service';
import type { WorkspaceKey } from './nav';

/** A number beside a nav item or a view tab, and whether it asks for action. */
export interface NavCount {
  count: number;
  tone?: 'attention' | 'stop';
}

/**
 * Every count the Console shows in its navigation, read once per request: the desk shows a
 * workspace's figure, the sheet header shows each view's. One place, so the two never disagree.
 */
export function navCounts(): { workspaces: Partial<Record<WorkspaceKey, NavCount>>; pages: Record<string, NavCount> } {
  const openTabs = trade.openTabs().length;
  const holds = inventory.activeHolds().length;
  const counts = inventory.counts();
  const running = counts.filter((c) => c.status === 'counting' || c.status === 'review').length;
  const inReview = counts.filter((c) => c.status === 'review').length;
  const reorder = procurement.reorderSuggestions().length;
  const openOrders = procurement.purchaseOrders().filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partially_received').length;
  const unsynced = sync.unresolvedCount();

  const pages: Record<string, NavCount> = {
    '/console/trade/open': { count: openTabs },
    '/console/inventory/counts': { count: running, tone: inReview > 0 ? 'attention' : undefined },
    '/console/inventory/holds': { count: holds, tone: 'attention' },
    '/console/purchasing/reorder': { count: reorder },
    '/console/purchasing/orders': { count: openOrders },
    '/console/catalogue/products': { count: catalogue.products().filter((p) => p.status === 'active').length },
    '/console/pricing/lists': { count: pricing.priceLists().filter((l) => l.status === 'active').length },
    '/console/pricing/rules': { count: pricing.rules().filter((r) => r.status === 'active').length },
    '/console/people/staff': { count: identity.staffList().filter((s) => s.employmentStatus === 'active').length },
    '/console/settings/devices': { count: identity.devices().filter((d) => d.status === 'active').length },
    '/console/settings/sync': { count: unsynced, tone: 'stop' },
  };

  return {
    workspaces: {
      trade: { count: openTabs },
      inventory: { count: holds + inReview, tone: 'attention' },
      purchasing: { count: reorder },
      settings: { count: unsynced, tone: 'stop' },
    },
    pages,
  };
}
