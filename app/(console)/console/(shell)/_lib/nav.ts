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
      { href: '/console/trade/open', label: 'Open tabs', keywords: ['tables', 'floor'] },
      { href: '/console/trade/bills', label: 'Bills', keywords: ['settled', 'payments', 'tenders'] },
      { href: '/console/trade/drawers', label: 'Drawers', keywords: ['till', 'cash', 'variance'] },
      { href: '/console/trade/shifts', label: 'Shifts', keywords: ['staff', 'handover'] },
    ],
  },
  {
    key: 'inventory',
    href: '/console/inventory',
    label: 'Inventory',
    description: 'Stock on hand, counts, movements, recipes and holds.',
    group: 'stock',
    pages: [
      { href: '/console/inventory/stock', label: 'Stock', keywords: ['on hand', 'levels'] },
      { href: '/console/inventory/counts', label: 'Counts', keywords: ['stock take', 'variance'] },
      { href: '/console/inventory/movements', label: 'Movements', keywords: ['ledger', 'write-off'] },
      { href: '/console/inventory/recipes', label: 'Recipes', keywords: ['cocktails', 'pour'] },
      { href: '/console/inventory/holds', label: 'Holds', keywords: ['86', 'unavailable'] },
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
      { href: '/console/purchasing/reorder', label: 'Reorder', keywords: ['suggestions', 'low stock'] },
      { href: '/console/purchasing/orders', label: 'Orders', keywords: ['purchase order', 'po'] },
      { href: '/console/purchasing/receipts', label: 'Deliveries', keywords: ['receipts', 'grn', 'goods received'] },
      { href: '/console/purchasing/suppliers', label: 'Suppliers', keywords: ['vendors', 'costs'] },
    ],
  },
  {
    key: 'catalogue',
    href: '/console/catalogue',
    label: 'Catalogue',
    description: 'The products, categories and modifiers the floor sells.',
    group: 'menu',
    pages: [
      { href: '/console/catalogue/products', label: 'Products', keywords: ['items', 'menu'] },
      { href: '/console/catalogue/categories', label: 'Categories' },
      { href: '/console/catalogue/modifiers', label: 'Modifiers', keywords: ['mixers', 'options'] },
    ],
  },
  {
    key: 'pricing',
    href: '/console/pricing',
    label: 'Pricing',
    description: 'Price lists and time rules. Prices include VAT.',
    group: 'menu',
    pages: [
      { href: '/console/pricing/lists', label: 'Price lists' },
      { href: '/console/pricing/rules', label: 'Time rules', keywords: ['happy hour'] },
    ],
  },
  {
    key: 'reports',
    href: '/console/reports',
    label: 'Reports',
    description: 'Sales, margin and stock performance, by business day.',
    group: 'business',
    pages: [
      { href: '/console/reports/performance', label: 'Performance', keywords: ['profit', 'margin', 'p&l'] },
      { href: '/console/reports/sales', label: 'Sales', keywords: ['revenue', 'hourly'] },
      { href: '/console/reports/pour-variance', label: 'Pour variance', keywords: ['shrinkage', 'loss'] },
      { href: '/console/reports/voids', label: 'Voids and discounts' },
      { href: '/console/reports/seats', label: 'Seats', keywords: ['guests', 'covers'] },
      { href: '/console/reports/dead-stock', label: 'Dead stock', keywords: ['slow moving'] },
    ],
  },
  {
    key: 'people',
    href: '/console/people',
    label: 'People',
    description: 'Staff, roles and permissions, and the zones and tables on the floor.',
    group: 'business',
    pages: [
      { href: '/console/people/staff', label: 'Staff', keywords: ['team', 'pin', 'waiters'] },
      { href: '/console/people/roles', label: 'Roles', keywords: ['permissions', 'access'] },
      { href: '/console/people/zoning', label: 'Zones and tables', keywords: ['floor plan', 'zoning'] },
    ],
  },
  {
    key: 'settings',
    href: '/console/settings',
    label: 'Settings',
    description: 'The outlet, its devices, what did not sync, and the audit trail.',
    group: 'system',
    pages: [
      { href: '/console/settings/outlet', label: 'Outlet', keywords: ['venue', 'vat', 'cutover'] },
      { href: '/console/settings/devices', label: 'Devices', keywords: ['tablets', 'stations'] },
      { href: '/console/settings/sync', label: 'Sync', keywords: ['unsent', 'dead letters'] },
      { href: '/console/settings/audit', label: 'Audit trail', keywords: ['log', 'history'] },
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

/** Every destination, for the command menu. */
export function destinations(): { href: string; label: string; context: string; keywords: string }[] {
  const out: { href: string; label: string; context: string; keywords: string }[] = [];
  for (const w of WORKSPACES) {
    if (w.pages.length === 0) out.push({ href: w.href, label: w.label, context: 'Workspace', keywords: (w.keywords ?? []).join(' ') });
    for (const p of w.pages) out.push({ href: p.href, label: p.label, context: w.label, keywords: [...(p.keywords ?? []), ...(w.keywords ?? [])].join(' ') });
  }
  return out;
}
