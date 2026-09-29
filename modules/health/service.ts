import 'server-only';

import { formatAgo, formatDateTime, formatElapsed, plural } from '@bliss/shared/format';
import { type Cents, isPositive } from '@bliss/shared/money';
import { dataset } from '../_data/source';
import { ping, storeEnabled } from '../_data/store';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import { whatsappEnv } from '../notify/config';
import * as notify from '../notify/service';
import * as pricing from '../pricing/service';
import * as reporting from '../reporting/service';
import * as settlement from '../settlement/service';
import * as sync from '../sync/service';
import * as trade from '../trade/service';
import { type VitalSample, sampleVitals, vitals } from './vitals';

/**
 * The app's vital signs, for Console, Settings, Health. Every check reads what is true now and says
 * it as ok, worth a look, or wrong, with the figure behind it and where to go about it. Nothing here
 * changes anything.
 */

export type HealthStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  value: string;
  detail: string;
  href?: string;
}

export interface HealthSystem {
  key: 'server' | 'stations' | 'trade' | 'stock' | 'alerts' | 'setup';
  title: string;
  summary: string;
  checks: HealthCheck[];
}

export type HealthTone = 'poured' | 'low' | 'stop' | 'info' | 'accent' | 'neutral';

export interface StationTile {
  id: string;
  label: string;
  kind: 'floor' | 'counter' | 'bar' | 'console';
  state: 'online' | 'offline' | 'pairing' | 'never';
  lastSeenAt: number | null;
  unsynced: number;
  who: string | null;
  version: string;
  behind: boolean;
  personal: boolean;
}

export interface HealthReport {
  at: number;
  status: HealthStatus;
  /** 100 with nothing wrong; a problem costs 12, a thing to look at 4. */
  score: number;
  counts: Record<'ok' | 'warn' | 'fail', number>;
  systems: HealthSystem[];
  /** Every problem, then everything to look at, each with the system it belongs to. */
  attention: (HealthCheck & { system: HealthSystem['key'] })[];
  vitals: { samples: readonly VitalSample[]; latest: VitalSample; since: number; node: string; build: string; uptimeMs: number };
  stations: StationTile[];
  trade: { hours: { key: string; label: string; value: Cents }[]; openTabs: number; drawers: number; shifts: number; bills: number; lastBillAt: number | null };
  stock: {
    tracked: number;
    segments: { key: string; label: string; value: number; tone: HealthTone }[];
    coverage: { key: string; label: string; done: number; total: number }[];
  };
  alerts: { configured: boolean } & notify.Delivery;
  setup: { done: number; total: number };
}

const HOUR = 3_600_000;
const worst = (checks: readonly HealthCheck[]): HealthStatus => (checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'ok');

function summarise(checks: readonly HealthCheck[], good: string): string {
  const fail = checks.filter((c) => c.status === 'fail').length;
  const warn = checks.filter((c) => c.status === 'warn').length;
  if (fail > 0) return `${plural(fail, 'problem')}${warn > 0 ? `, ${warn} to look at` : ''}`;
  if (warn > 0) return `${plural(warn, 'thing')} to look at`;
  return good;
}

async function server(): Promise<HealthCheck[]> {
  const db = await ping();
  const d = dataset();
  const mem = process.memoryUsage();
  const checks: HealthCheck[] = [];
  if (db === null) {
    checks.push({ id: 'db', label: 'Database', status: storeEnabled() ? 'fail' : 'warn', value: 'In memory', detail: 'No database is set: nothing is kept past a restart. Set DATABASE_URL.' });
  } else if ('error' in db) {
    checks.push({ id: 'db', label: 'Database', status: 'fail', value: 'Unreachable', detail: db.error });
  } else {
    checks.push({ id: 'db', label: 'Database', status: db.ms > 800 ? 'warn' : 'ok', value: `${db.ms} ms`, detail: `Neon Postgres answered in ${db.ms} ms, ${db.rows.toLocaleString('en-KE')} records held.` });
    checks.push({
      id: 'db-version',
      label: 'This server is up to date',
      status: db.loaded >= db.version ? 'ok' : 'warn',
      value: `v${db.loaded}`,
      detail: db.loaded >= db.version ? 'Holds the latest change saved.' : `The database is at v${db.version}; this server catches up on its next read.`,
    });
  }
  const up = process.uptime() * 1000;
  checks.push({ id: 'uptime', label: 'Server running for', status: 'info', value: uptime(up), detail: `Node ${process.version}, build ${process.env.NEXT_PUBLIC_BLISS_VERSION ?? 'dev'}.` });
  const heapMb = Math.round(mem.heapUsed / 1_048_576);
  checks.push({ id: 'memory', label: 'Memory', status: heapMb > 900 ? 'warn' : 'ok', value: `${heapMb} MB`, detail: `${Math.round(mem.rss / 1_048_576)} MB held by the process in all.` });
  const clock = reporting.clock();
  checks.push({ id: 'clock', label: 'Business day', status: 'info', value: clock.current, detail: `${clock.tradingInProgress ? 'Trading hours now' : 'Outside trading hours'}. The day ends at ${identity.outlet().businessDayCutover}, ${identity.outlet().timezone}.` });
  checks.push({ id: 'epoch', label: 'Data generation', status: 'info', value: d.epoch.split(':')[0] ?? d.epoch, detail: 'Starts again on a handover or a trade clear; stations reload when it changes.' });
  return checks;
}

function stations(): HealthCheck[] {
  const devices = identity.devices().filter((d) => d.status === 'active');
  const version = process.env.NEXT_PUBLIC_BLISS_VERSION ?? '';
  const checks: HealthCheck[] = [];
  if (devices.length === 0) {
    checks.push({ id: 'devices', label: 'Stations', status: 'warn', value: 'None', detail: 'No tablet or counter is registered. Register them in Settings, Devices.', href: '/console/settings/devices' });
    return checks;
  }
  for (const d of devices) {
    const seen = d.lastSeenAt ? Date.now() - d.lastSeenAt : null;
    const status: HealthStatus = d.pairingPending ? 'warn' : d.online ? (d.unsyncedCount > 0 ? 'warn' : 'ok') : seen !== null && seen < 12 * HOUR ? 'warn' : 'info';
    const who = d.signedInStaffId ? identity.displayName(d.signedInStaffId) : null;
    const detail = d.pairingPending
      ? 'Waiting for its pairing code.'
      : d.online
        ? `${who ? `${who} signed in. ` : ''}${d.unsyncedCount > 0 ? `${plural(d.unsyncedCount, 'change')} not yet sent.` : 'Everything sent.'}${version && d.appVersion && d.appVersion !== version ? ` Running ${d.appVersion}; reloading gets ${version}.` : ''}`
        : seen === null
          ? 'Never seen.'
          : `Last seen ${formatAgo(seen)}.${d.unsyncedCount > 0 ? ` Held ${plural(d.unsyncedCount, 'change')} then.` : ''}`;
    checks.push({ id: `device-${d.id}`, label: d.label, status, value: d.pairingPending ? 'Not paired' : d.online ? 'Online' : 'Offline', detail, href: `/console/settings/devices/${d.id}` });
  }
  const letters = sync.deadLetters({ resolved: false });
  checks.push({ id: 'dead-letters', label: 'Refused changes', status: letters.length > 0 ? 'fail' : 'ok', value: String(letters.length), detail: letters.length > 0 ? 'A station sent something the server would not accept. Each needs a person.' : 'Every change a station sent was accepted.', href: '/console/settings/sync' });
  return checks;
}

function tradeChecks(): HealthCheck[] {
  const now = Date.now();
  const clock = reporting.clock();
  const open = trade.openTabs();
  const stale = open.filter((t) => now - t.tab.openedAt > 14 * HOUR);
  const drawers = settlement.drawerSessions().filter((s) => s.status !== 'closed');
  const oldDrawers = drawers.filter((s) => s.businessDate < clock.current);
  const shifts = dataset().shifts.filter((s) => s.status === 'open');
  const longShifts = shifts.filter((s) => now - s.startedAt > 16 * HOUR);
  const bills = settlement.billsOn(clock.current).filter((b) => b.status !== 'open');
  return [
    { id: 'open-tabs', label: 'Open tabs', status: stale.length > 0 ? 'warn' : 'ok', value: String(open.length), detail: stale.length > 0 ? `${plural(stale.length, 'tab')} open more than 14 hours: settle or void ${stale.length === 1 ? 'it' : 'them'}.` : open.length > 0 ? 'All opened tonight.' : 'None on the floor.', href: '/console/trade/open' },
    { id: 'drawers', label: 'Drawers open', status: oldDrawers.length > 0 ? 'warn' : 'ok', value: String(drawers.length), detail: oldDrawers.length > 0 ? `${plural(oldDrawers.length, 'drawer')} from an earlier day never closed.` : drawers.length > 0 ? 'Open for tonight.' : 'None open.', href: '/console/trade/drawers' },
    { id: 'shifts', label: 'Shifts running', status: longShifts.length > 0 ? 'warn' : 'ok', value: String(shifts.length), detail: longShifts.length > 0 ? `${plural(longShifts.length, 'shift')} running more than 16 hours: someone forgot to sign out.` : shifts.length > 0 ? shifts.map((s) => identity.displayName(s.staffId)).join(', ') : 'Nobody signed in.', href: '/console/trade/shifts' },
    { id: 'bills', label: 'Bills today', status: 'info', value: String(bills.length), detail: bills.length > 0 ? `Last settled ${formatDateTime(Math.max(...bills.map((b) => b.settledAt ?? 0)), identity.outlet().timezone)}.` : 'Nothing settled yet today.', href: '/console/trade/bills?range=tonight' },
  ];
}

function stock(): HealthCheck[] {
  const products = catalogue.products().filter((p) => p.status === 'active');
  const variants = catalogue.variants().filter((v) => v.status === 'active');
  const unpriced = variants.filter((v) => products.some((p) => p.id === v.productId) && !pricing.currentPrice(v.id));
  const noPhoto = products.filter((p) => !p.imageKey);
  const stockVariants = catalogue.stockVariants().filter((v) => {
    const p = catalogue.productById(v.productId);
    return p?.status === 'active' && catalogue.categoryById(p.categoryId)?.trackStock && !p.unitsInHouse;
  });
  const uncounted = stockVariants.filter((v) => !inventory.stockRecorded(v.id));
  const recount = stockVariants.filter((v) => inventory.needsCount(v.id));
  const noCost = stockVariants.filter((v) => !isPositive(inventory.averageCost(v.id)));
  const below = inventory.belowZeroCount();
  return [
    { id: 'below-zero', label: 'Stock below zero', status: below > 0 ? 'fail' : 'ok', value: String(below), detail: below > 0 ? 'Brought to zero in the background within a minute, then flagged Count needed.' : 'No balance anywhere reads below zero.', href: '/console/inventory/stock' },
    { id: 'recount', label: 'Count needed', status: recount.length > 0 ? 'warn' : 'ok', value: String(recount.length), detail: recount.length > 0 ? 'Sold beyond the record since their last count: count them.' : 'Every counted item matches what was sold.', href: '/console/inventory/stock' },
    { id: 'uncounted', label: 'Not counted yet', status: uncounted.length > 0 ? 'warn' : 'ok', value: `${uncounted.length} of ${stockVariants.length}`, detail: uncounted.length > 0 ? 'Not on sale: none is on the shelf until a count or a delivery records it. Count them, or set trial stock.' : 'Every stock-kept item has been counted or received.', href: '/console/inventory/counts/new' },
    { id: 'no-cost', label: 'Unit cost not set', status: noCost.length > 0 ? 'warn' : 'ok', value: `${noCost.length} of ${stockVariants.length}`, detail: noCost.length > 0 ? 'Profit and stock value leave these out until a delivery or the product form sets a cost.' : 'Every stock-kept item has a cost.', href: '/console/catalogue/products' },
    { id: 'unpriced', label: 'Not priced', status: unpriced.length > 0 ? 'fail' : 'ok', value: String(unpriced.length), detail: unpriced.length > 0 ? `${unpriced.slice(0, 3).map((v) => v.name).join(', ')}${unpriced.length > 3 ? ' and more' : ''} cannot be sold.` : 'Everything on the menu has a price.', href: '/console/pricing/lists' },
    { id: 'photos', label: 'Without a photo', status: noPhoto.length > 0 ? 'info' : 'ok', value: String(noPhoto.length), detail: noPhoto.length > 0 ? 'They show their initial on the floor.' : 'Every product has a photo.', href: '/console/catalogue/products' },
  ];
}

function alerts(): HealthCheck[] {
  const env = whatsappEnv();
  const recent = notify.recent(200);
  const failed = recent.filter((n) => n.status === 'failed');
  const waiting = recent.filter((n) => n.status === 'queued' || n.status === 'sending');
  const last = recent.find((n) => n.sentAt);
  const recipients = notify.settings().recipients.filter((r) => r.active).length;
  return [
    { id: 'wa-connected', label: 'WhatsApp business number', status: env.configured ? 'ok' : 'warn', value: env.configured ? 'Connected' : 'Not connected', detail: env.configured ? `Sending to ${plural(recipients, 'number')}.` : 'Alerts wait until it is connected.', href: '/console/settings/whatsapp' },
    { id: 'wa-webhook', label: 'Delivery receipts', status: env.configured ? (env.appSecret && env.verifyToken ? 'ok' : 'warn') : 'info', value: env.appSecret && env.verifyToken ? 'Set up' : 'Not set', detail: env.appSecret && env.verifyToken ? 'WhatsApp reports delivered and read.' : 'Set WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN to hear back.', href: '/console/settings/whatsapp' },
    { id: 'wa-queue', label: 'Alerts waiting', status: env.configured && waiting.length > 5 ? 'warn' : 'ok', value: String(waiting.length), detail: waiting.length > 0 ? (env.configured ? 'Going out now.' : 'Held until the number is connected.') : 'Nothing held back.', href: '/console/settings/whatsapp' },
    { id: 'wa-failed', label: 'Alerts failed', status: failed.length > 0 ? 'fail' : 'ok', value: String(failed.length), detail: failed.length > 0 ? (failed[0]!.lastError ?? 'See the log.') : last?.sentAt ? `Last sent ${formatDateTime(last.sentAt, identity.outlet().timezone)}.` : 'None sent yet.', href: '/console/settings/whatsapp' },
  ];
}

function setup(): HealthCheck[] {
  const outlet = identity.outlet();
  const owners = identity.staffList().filter((s) => s.employmentStatus === 'active' && identity.roleFor(s.id)?.key === 'owner');
  const temporaryPin = owners.some((s) => s.pinMustChange);
  const secret = Boolean(process.env.BLISS_SESSION_SECRET);
  return [
    { id: 'session-secret', label: 'Sign-in secret', status: secret ? 'ok' : process.env.NODE_ENV === 'production' ? 'fail' : 'warn', value: secret ? 'Set' : 'Missing', detail: secret ? 'Sign-ins are signed with the outlet’s own secret.' : 'Set BLISS_SESSION_SECRET so sign-ins survive a redeploy and cannot be forged.' },
    { id: 'owner-pin', label: 'Owner PIN', status: temporaryPin ? 'warn' : 'ok', value: temporaryPin ? 'Temporary' : 'Chosen', detail: temporaryPin ? 'The handover PIN is still in use: change it under your name in the rail.' : 'The owner chose their own PIN.' },
    { id: 'tills', label: 'M-Pesa tills', status: outlet.tills?.bar && outlet.tills?.kitchen ? 'ok' : 'warn', value: [outlet.tills?.bar, outlet.tills?.kitchen].filter(Boolean).join(' · ') || 'Not set', detail: outlet.tills?.bar && outlet.tills?.kitchen ? 'Printed on every bill.' : 'Bills print no till until set in Settings, Outlet.', href: '/console/settings/outlet' },
    { id: 'phone', label: 'Phone on bills', status: outlet.phone ? 'ok' : 'warn', value: outlet.phone || 'Not set', detail: outlet.phone ? 'Printed under the address.' : 'Set it in Settings, Outlet.', href: '/console/settings/outlet' },
  ];
}


function stationTiles(): StationTile[] {
  const version = process.env.NEXT_PUBLIC_BLISS_VERSION ?? '';
  const order = { online: 0, pairing: 1, offline: 2, never: 3 } as const;
  return identity
    .devices()
    .filter((d) => d.status === 'active')
    .map((d): StationTile => ({
      id: d.id,
      label: d.label,
      kind: d.kind,
      state: d.pairingPending ? 'pairing' : d.online ? 'online' : d.lastSeenAt ? 'offline' : 'never',
      lastSeenAt: d.lastSeenAt,
      unsynced: d.unsyncedCount,
      who: d.signedInStaffId ? identity.displayName(d.signedInStaffId) : null,
      version: d.appVersion,
      behind: Boolean(version && d.appVersion && d.appVersion !== version),
      personal: Boolean(d.personalTo),
    }))
    .sort((a, b) => order[a.state] - order[b.state] || Number(a.personal) - Number(b.personal) || a.label.localeCompare(b.label));
}

function tradeFigures(): HealthReport['trade'] {
  const clock = reporting.clock();
  const bills = settlement.billsOn(clock.current).filter((b) => b.status !== 'open');
  const settled = bills.map((b) => b.settledAt ?? 0).filter((t) => t > 0);
  return {
    hours: reporting.salesByHour(clock.current).map((h) => ({ key: h.hour, label: h.hour, value: h.value })),
    openTabs: trade.openTabs().length,
    drawers: settlement.drawerSessions().filter((s) => s.status !== 'closed').length,
    shifts: dataset().shifts.filter((s) => s.status === 'open').length,
    bills: bills.length,
    lastBillAt: settled.length > 0 ? Math.max(...settled) : null,
  };
}

function stockFigures(): HealthReport['stock'] {
  const products = catalogue.products().filter((p) => p.status === 'active');
  const variants = catalogue.variants().filter((v) => v.status === 'active' && products.some((p) => p.id === v.productId));
  const tracked = catalogue.stockVariants().filter((v) => {
    const p = catalogue.productById(v.productId);
    return p?.status === 'active' && catalogue.categoryById(p.categoryId)?.trackStock && !p.unitsInHouse;
  });
  // Each item in exactly one state, the most pressing first.
  let below = 0;
  let recount = 0;
  let uncounted = 0;
  let good = 0;
  for (const v of tracked) {
    if (inventory.onHand(v.id) < 0) below += 1;
    else if (inventory.needsCount(v.id)) recount += 1;
    else if (!inventory.stockRecorded(v.id)) uncounted += 1;
    else good += 1;
  }
  return {
    tracked: tracked.length,
    segments: [
      { key: 'good', label: 'In good order', value: good, tone: 'poured' },
      { key: 'uncounted', label: 'Not counted yet', value: uncounted, tone: 'info' },
      { key: 'recount', label: 'Count needed', value: recount, tone: 'low' },
      { key: 'below', label: 'Below zero', value: below, tone: 'stop' },
    ],
    coverage: [
      { key: 'priced', label: 'Priced', done: variants.filter((v) => pricing.currentPrice(v.id)).length, total: variants.length },
      { key: 'counted', label: 'Counted', done: tracked.length - uncounted, total: tracked.length },
      { key: 'costed', label: 'Costed', done: tracked.filter((v) => isPositive(inventory.averageCost(v.id))).length, total: tracked.length },
      { key: 'photos', label: 'Photos', done: products.filter((p) => p.imageKey).length, total: products.length },
    ],
  };
}

function alertFigures(): HealthReport['alerts'] {
  return { configured: whatsappEnv().configured, ...notify.delivery() };
}

export async function report(): Promise<HealthReport> {
  const latest = await sampleVitals({ force: true });
  const systems: HealthSystem[] = [];
  const add = (key: HealthSystem['key'], title: string, good: string, checks: HealthCheck[]) => systems.push({ key, title, summary: summarise(checks, good), checks });
  add('server', 'Server and database', 'Answering, and up to date', await server());
  add('stations', 'Stations and sync', 'Every station reaching the server', stations());
  add('trade', 'Trade', 'Nothing left open from before', tradeChecks());
  add('stock', 'Stock and menu', 'Priced, counted and above zero', stock());
  add('alerts', 'WhatsApp alerts', 'Sending, nothing failed', alerts());
  add('setup', 'Set-up', 'Everything in place', setup());
  const all = systems.flatMap((s) => s.checks);
  const counts = { ok: all.filter((c) => c.status === 'ok').length, warn: all.filter((c) => c.status === 'warn').length, fail: all.filter((c) => c.status === 'fail').length };
  const attention = systems
    .flatMap((s) => s.checks.map((c) => ({ ...c, system: s.key })))
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1));
  const setupChecks = systems.find((s) => s.key === 'setup')!.checks;
  const samples = vitals();
  return {
    at: Date.now(),
    status: worst(all),
    score: Math.max(0, 100 - counts.fail * 12 - counts.warn * 4),
    counts,
    systems,
    attention,
    vitals: { samples, latest, since: samples[0]?.at ?? latest.at, node: process.version, build: process.env.NEXT_PUBLIC_BLISS_VERSION ?? 'dev', uptimeMs: process.uptime() * 1000 },
    stations: stationTiles(),
    trade: tradeFigures(),
    stock: stockFigures(),
    alerts: alertFigures(),
    setup: { done: setupChecks.filter((c) => c.status === 'ok').length, total: setupChecks.length },
  };
}

export { worst as worstOf, uptime as formatUptime };

/** How long the server has been up, in the unit that reads best: 12 min, 3h05, 2 days 4h. */
function uptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Under a minute';
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  return days > 0 ? `${plural(days, 'day')} ${Math.floor((minutes % 1440) / 60)}h` : formatElapsed(ms);
}
