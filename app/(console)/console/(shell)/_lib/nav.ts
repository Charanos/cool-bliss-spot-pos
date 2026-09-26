import type { PermissionKey } from '@bliss/shared/domain';

/**
 * The Console's map, in one place. docs/19 section 4.
 *
 * The rail, each workspace's header and tabs, the breadcrumbs, the command menu and every page's
 * title read from this, so a workspace is called the same thing everywhere and a new page appears
 * in all of them at once. No React here: the client top bar and command menu import it too.
 */

export type NavGroup = 'service' | 'stock' | 'menu' | 'business' | 'system';

export const NAV_GROUPS: readonly { key: NavGroup; label: string }[] = [
  { key: 'service', label: 'Service' },
  { key: 'stock', label: 'Stock' },
  { key: 'menu', label: 'Menu' },
  { key: 'business', label: 'Business' },
];

export type WorkspaceKey = 'overview' | 'trade' | 'inventory' | 'purchasing' | 'catalogue' | 'pricing' | 'reports' | 'people' | 'settings';

export interface NavPage {
  href: string;
  label: string;
  /** One sentence under the page title: what the page answers or lets you do. */
  description: string;
  /** Extra words the command menu matches: "till" finds Drawers. */
  keywords?: readonly string[];
}

export interface NavWorkspace {
  key: WorkspaceKey;
  href: string;
  /** The rail and breadcrumb name. */
  label: string;
  /** One sentence: what the workspace answers or lets you do. */
  description: string;
  group: NavGroup;
  /** Hidden from the rail and refused on its pages without this permission. */
  permission?: PermissionKey;
  pages: readonly NavPage[];
  keywords?: readonly string[];
}

export const WORKSPACES: readonly NavWorkspace[] = [
  {
    key: 'overview',
    href: '/console/overview',
    label: 'Overview',
    description: 'Last night at a glance, and what needs you now.',
    group: 'service',
    pages: [],
    keywords: ['home', 'dashboard', 'today'],
  },
  {
    key: 'trade',
    href: '/console/trade',
    label: 'Trade',
    description: 'Open tabs, settled bills, drawer sessions and shifts.',
    group: 'service',
    pages: [
      { href: '/console/trade/open', label: 'Open tabs', description: 'Every tab on the floor now, what it holds, and how long it has been open.', keywords: ['tables', 'floor'] },
      { href: '/console/trade/bills', label: 'Bills', description: 'Settled bills by business day, how they were paid, and each one in full.', keywords: ['settled', 'payments', 'tenders'] },
      { href: '/console/trade/drawers', label: 'Drawers', description: 'Cash drawer sessions: what was expected, what was counted, and the difference.', keywords: ['till', 'cash', 'variance'] },
      { href: '/console/trade/shifts', label: 'Shifts', description: 'Who worked, when, on which station, and what they sold.', keywords: ['staff', 'handover'] },
    ],
  },
  {
    key: 'inventory',
    href: '/console/inventory',
    label: 'Inventory',
    description: 'Stock on hand, counts, movements, recipes and holds.',
    group: 'stock',
    pages: [
      { href: '/console/inventory/stock', label: 'Stock', description: 'What is on hand at cost, what is running low, and what the floor cannot sell.', keywords: ['on hand', 'levels'] },
      { href: '/console/inventory/counts', label: 'Counts', description: 'Stock counts from start to commit, and the variance each one found.', keywords: ['stock take', 'variance'] },
      { href: '/console/inventory/movements', label: 'Movements', description: 'Every change to stock: sales, deliveries, counts and write-offs.', keywords: ['ledger', 'write-off'] },
      { href: '/console/inventory/recipes', label: 'Recipes', description: 'What each drink and dish draws from stock, and what a serve costs.', keywords: ['cocktails', 'pour'] },
      { href: '/console/inventory/holds', label: 'Holds', description: 'Items taken off sale, why, and when they come back.', keywords: ['86', 'unavailable'] },
    ],
  },
  {
    key: 'purchasing',
    href: '/console/purchasing',
    label: 'Purchasing',
    description: 'What to reorder, orders with suppliers, and deliveries received.',
    group: 'stock',
    permission: 'cost.read',
    pages: [
      { href: '/console/purchasing/reorder', label: 'Reorder', description: 'What is below its reorder point, grouped by the supplier to order from.', keywords: ['suggestions', 'low stock'] },
      { href: '/console/purchasing/orders', label: 'Orders', description: 'Purchase orders from raised to received.', keywords: ['purchase order', 'po'] },
      { href: '/console/purchasing/receipts', label: 'Deliveries', description: 'Deliveries received, what was short or rejected, and what they cost.', keywords: ['receipts', 'grn', 'goods received'] },
      { href: '/console/purchasing/suppliers', label: 'Suppliers', description: 'Who supplies what, on what terms, and how their costs have moved.', keywords: ['vendors', 'costs'] },
    ],
  },
  {
    key: 'catalogue',
    href: '/console/catalogue',
    label: 'Catalogue',
    description: 'The products, categories and modifiers the floor sells.',
    group: 'menu',
    pages: [
      { href: '/console/catalogue/products', label: 'Products', description: 'Everything the floor sells, how it is sold, and where its stock comes from.', keywords: ['items', 'menu'] },
      { href: '/console/catalogue/categories', label: 'Categories', description: 'How the menu is grouped on the floor and in reports.' },
      { href: '/console/catalogue/modifiers', label: 'Modifiers', description: 'Mixers, sizes and options a waiter adds to a line.', keywords: ['mixers', 'options'] },
    ],
  },
  {
    key: 'pricing',
    href: '/console/pricing',
    label: 'Pricing',
    description: 'Price lists and time rules. Prices include VAT.',
    group: 'menu',
    pages: [
      { href: '/console/pricing/lists', label: 'Price lists', description: 'What each item costs a guest, list by list.' },
      { href: '/console/pricing/rules', label: 'Time rules', description: 'When a price list takes over: happy hours and special nights.', keywords: ['happy hour'] },
    ],
  },
  {
    key: 'reports',
    href: '/console/reports',
    label: 'Reports',
    description: 'Sales, margin and stock performance, by business day.',
    group: 'business',
    pages: [
      { href: '/console/reports/performance', label: 'Performance', description: 'Sales, margin and cost for a range of business days.', keywords: ['profit', 'margin', 'p&l'] },
      { href: '/console/reports/sales', label: 'Sales', description: 'Takings by day and hour, by tender, and against the week before.', keywords: ['revenue', 'hourly'] },
      { href: '/console/reports/pour-variance', label: 'Pour variance', description: 'What the counts found against what the floor sold.', keywords: ['shrinkage', 'loss'] },
      { href: '/console/reports/voids', label: 'Voids and discounts', description: 'Lines voided and discounts given, by person and by reason.' },
      { href: '/console/reports/seats', label: 'Seats', description: 'How many guests came, how they sat, and what each spent.', keywords: ['guests', 'covers'] },
      { href: '/console/reports/dead-stock', label: 'Dead stock', description: 'Stock that has not sold, and the cash it holds.', keywords: ['slow moving'] },
    ],
  },
  {
    key: 'people',
    href: '/console/people',
    label: 'People',
    description: 'Staff, roles and permissions, and the zones and tables on the floor.',
    group: 'business',
    pages: [
      { href: '/console/people/staff', label: 'Staff', description: 'Everyone who works here, their role, and whether they can sign in.', keywords: ['team', 'pin', 'waiters'] },
      { href: '/console/people/roles', label: 'Roles', description: 'What each role can see and do.', keywords: ['permissions', 'access'] },
      { href: '/console/people/zoning', label: 'Zones and tables', description: 'The floor\'s zones and tables, and the price list each zone uses.', keywords: ['floor plan', 'zoning'] },
    ],
  },
  {
    key: 'settings',
    href: '/console/settings',
    label: 'Settings',
    description: 'The outlet, its devices, what did not sync, and the audit trail.',
    group: 'system',
    pages: [
      { href: '/console/settings/outlet', label: 'Outlet', description: 'The outlet\'s name, tax details and when the business day ends.', keywords: ['venue', 'vat', 'cutover'] },
      { href: '/console/settings/devices', label: 'Devices', description: 'The tablets and counters signed in to this outlet.', keywords: ['tablets', 'stations'] },
      { href: '/console/settings/sync', label: 'Sync', description: 'Orders a station sent that the server could not accept.', keywords: ['unsent', 'dead letters'] },
      { href: '/console/settings/audit', label: 'Audit trail', description: 'Every change made in the Console, who made it, and what it was before.', keywords: ['log', 'history'] },
    ],
  },
];

export function workspaceByKey(key: WorkspaceKey): NavWorkspace {
  return WORKSPACES.find((w) => w.key === key)!;
}

/** The workspace a path belongs to. */
export function workspaceFor(pathname: string): NavWorkspace | null {
  return WORKSPACES.find((w) => pathname === w.href || pathname.startsWith(`${w.href}/`)) ?? null;
}

/** The page a path belongs to: its own page, or the list page a record page sits under. */
export function pageFor(pathname: string): { workspace: NavWorkspace; page: NavPage | null } | null {
  const workspace = workspaceFor(pathname);
  if (!workspace) return null;
  let page: NavPage | null = null;
  for (const p of workspace.pages) {
    if ((pathname === p.href || pathname.startsWith(`${p.href}/`)) && (!page || p.href.length > page.href.length)) page = p;
  }
  return { workspace, page };
}

/** A record page: under a workspace, but not one of its list pages. It gets no workspace tabs. */
export function isRecordPath(pathname: string): boolean {
  const found = pageFor(pathname);
  if (!found) return false;
  if (pathname === found.workspace.href) return false;
  return !found.workspace.pages.some((p) => p.href === pathname);
}

export interface Crumb {
  label: string;
  href: string | null;
}

/** Workspace, then page, then the record a detail page names (it supplies that one itself). */
export function crumbsFor(pathname: string, record?: string | null): Crumb[] {
  const found = pageFor(pathname);
  if (!found) return [{ label: 'Console', href: null }];
  const crumbs: Crumb[] = [{ label: found.workspace.label, href: found.workspace.pages.length ? (found.workspace.pages[0]?.href ?? found.workspace.href) : found.workspace.href }];
  if (found.page) crumbs.push({ label: found.page.label, href: found.page.href });
  if (record) crumbs.push({ label: record, href: null });
  // The last crumb is where you are: not a link.
  crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1]!, href: null };
  return crumbs;
}

/** A list page's own entry, for its header. */
export function pageByHref(href: string): { workspace: NavWorkspace; page: NavPage } {
  for (const w of WORKSPACES) {
    const page = w.pages.find((p) => p.href === href);
    if (page) return { workspace: w, page };
  }
  throw new Error(`No nav entry for ${href}`);
}

/** Every destination, for the command menu. */
export function destinations(): { href: string; label: string; context: string; keywords: string }[] {
  const out: { href: string; label: string; context: string; keywords: string }[] = [];
  for (const w of WORKSPACES) {
    if (w.pages.length === 0) out.push({ href: w.href, label: w.label, context: 'Workspace', keywords: (w.keywords ?? []).join(' ') });
    for (const p of w.pages) out.push({ href: p.href, label: p.label, context: w.label, keywords: [...(p.keywords ?? []), ...(w.keywords ?? [])].join(' ') });
  }
  return out;
}

/** Every kind of record the Console has a page for. */
export type RecordKind =
  | 'product'
  | 'category'
  | 'modifier'
  | 'priceList'
  | 'rule'
  | 'recipe'
  | 'supplier'
  | 'order'
  | 'receipt'
  | 'count'
  | 'bill'
  | 'tab'
  | 'staff'
  | 'role'
  | 'drawer'
  | 'shift'
  | 'device'
  | 'location'
  | 'zone';

const RECORD_HREF: Record<RecordKind, (id: string) => string> = {
  product: (id) => `/console/catalogue/products/${id}`,
  category: (id) => `/console/catalogue/categories/${id}`,
  modifier: (id) => `/console/catalogue/modifiers/${id}`,
  priceList: (id) => `/console/pricing/lists/${id}`,
  rule: (id) => `/console/pricing/rules/${id}`,
  recipe: (id) => `/console/inventory/recipes/${id}`,
  supplier: (id) => `/console/purchasing/suppliers/${id}`,
  order: (id) => `/console/purchasing/orders/${id}`,
  receipt: (id) => `/console/purchasing/receipts/${id}`,
  count: (id) => `/console/inventory/counts/${id}`,
  bill: (id) => `/console/trade/bills/${id}`,
  tab: (id) => `/console/trade/tabs/${id}`,
  staff: (id) => `/console/people/staff/${id}`,
  role: (id) => `/console/people/roles/${id}`,
  drawer: (id) => `/console/trade/drawers/${id}`,
  shift: (id) => `/console/trade/shifts/${id}`,
  device: (id) => `/console/settings/devices/${id}`,
  location: () => '/console/settings/locations',
  zone: () => '/console/people/zoning',
};

/** The page for one record. Every name the Console shows links through this, so nothing dead-ends. */
export function hrefFor(kind: RecordKind, id: string): string {
  return RECORD_HREF[kind](encodeURIComponent(id));
}
