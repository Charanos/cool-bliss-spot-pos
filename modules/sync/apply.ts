import 'server-only';

import type { SyncTable } from '@bliss/db/seed/types';
import { isStaffSurface } from '@bliss/shared/identity';
import type { Actor } from '@bliss/shared/reason';
import { type OutboxKind, type OutboxPayload, REJECTION_COPY, type RejectionCode, outboxPayloads } from '@bliss/shared/sync';
import { CommandRejected, changedSince, currentSeq } from '../_data/changes';
import { dataset } from '../_data/source';
import * as identity from '../identity/service';
import * as settlementCommands from '../settlement/commands';
import * as settlement from '../settlement/service';
import * as tradeCommands from '../trade/commands';
import * as trade from '../trade/service';
import { syncTables } from './schema';

/**
 * The development applier behind POST /api/dev/sync/push, and the change feed behind pull. docs/14
 * section 4. This is the shape of Phase 4: entries are applied through the owning module, in order,
 * once; a refusal becomes a dead letter a manager can see in Console, Settings, Sync.
 */

export interface IncomingEntry {
  id: string;
  seq: number;
  deviceId: string;
  staffId: string;
  kind: OutboxKind;
  aggregateId: string;
  payload: unknown;
  clientAt: number;
}

export type ApplyResult =
  | { id: string; status: 'acked'; idempotent: boolean; stockConflictLineIds?: string[] }
  | { id: string; status: 'rejected'; code: RejectionCode; detail: string };

/** Only a counter pours, settles and runs a drawer. */
const COUNTER_ONLY: ReadonlySet<OutboxKind> = new Set(['line.serve', 'bill.settle', 'drawer.open', 'drawer.drop']);

const rejectedEarlier = (globalThis as unknown as { __blissRejected?: Map<string, ApplyResult> }).__blissRejected ?? new Map<string, ApplyResult>();
(globalThis as unknown as { __blissRejected?: typeof rejectedEarlier }).__blissRejected = rejectedEarlier;

function reject(entry: IncomingEntry, code: RejectionCode, detail: string): ApplyResult {
  const result: ApplyResult = { id: entry.id, status: 'rejected', code, detail };
  rejectedEarlier.set(entry.id, result);
  const letters = syncTables().deadLetters;
  if (!letters.some((d) => d.outboxEntryId === entry.id)) {
    letters.push({
      id: `dead:${entry.id}`,
      deviceId: entry.deviceId,
      outboxEntryId: entry.id,
      kind: entry.kind,
      payload: entry.payload,
      rejectionCode: code,
      rejectionDetail: detail,
      firstSeenAt: Date.now(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    });
  }
  return result;
}

export function applyEntry(entry: IncomingEntry): ApplyResult {
  const data = dataset();
  if (data.applied.has(entry.id)) return { id: entry.id, status: 'acked', idempotent: true };
  const earlier = rejectedEarlier.get(entry.id);
  if (earlier) return earlier;

  const device = identity.devices().find((d) => d.id === entry.deviceId);
  if (!device || device.status !== 'active') return reject(entry, 'DEVICE_REVOKED', REJECTION_COPY.DEVICE_REVOKED);
  if (!isStaffSurface(device.kind)) return reject(entry, 'WRONG_SURFACE', REJECTION_COPY.WRONG_SURFACE);
  if (COUNTER_ONLY.has(entry.kind) && device.kind !== 'counter') return reject(entry, 'WRONG_SURFACE', 'Pouring, settling and the drawer happen at a counter device.');
  if (!identity.staffById(entry.staffId)) return reject(entry, 'VALIDATION_FAILED', 'The person who made this change is not on the team.');

  const parsed = outboxPayloads[entry.kind].safeParse(entry.payload);
  if (!parsed.success) return reject(entry, 'VALIDATION_FAILED', parsed.error.issues[0]?.message ?? REJECTION_COPY.VALIDATION_FAILED);

  const actor: Actor = { staffId: entry.staffId, deviceId: entry.deviceId };
  try {
    const conflicts = run(entry.kind, parsed.data, actor);
    data.applied.add(entry.id);
    return { id: entry.id, status: 'acked', idempotent: false, stockConflictLineIds: conflicts };
  } catch (error) {
    if (error instanceof CommandRejected) return reject(entry, error.code, error.message);
    throw error;
  }
}

function run(kind: OutboxKind, payload: unknown, actor: Actor): string[] {
  // Each payload was validated against its own schema just above.
  const as = <K extends OutboxKind>() => payload as OutboxPayload<K>;
  switch (kind) {
    case 'tab.open':
      tradeCommands.openTab(as<'tab.open'>(), actor);
      return [];
    case 'seat.add':
      tradeCommands.addSeat(as<'seat.add'>(), actor);
      return [];
    case 'seat.label':
      tradeCommands.labelSeat(as<'seat.label'>());
      return [];
    case 'seat.remove':
      tradeCommands.removeSeat(as<'seat.remove'>());
      return [];
    case 'order.fire':
      return tradeCommands.fireOrder(as<'order.fire'>(), actor).stockConflictLineIds;
    case 'line.move':
      tradeCommands.moveLine(as<'line.move'>(), actor);
      return [];
    case 'line.note':
      tradeCommands.noteLine(as<'line.note'>());
      return [];
    case 'line.void':
      tradeCommands.voidLine(as<'line.void'>(), actor);
      return [];
    case 'line.serve':
      tradeCommands.serveLines(as<'line.serve'>(), actor);
      return [];
    case 'tab.move':
      tradeCommands.moveTab(as<'tab.move'>(), actor);
      return [];
    case 'tab.handover':
      tradeCommands.handOver(as<'tab.handover'>(), actor);
      return [];
    case 'bill.settle':
      settlementCommands.settleBill(as<'bill.settle'>(), actor);
      return [];
    case 'drawer.open':
      settlementCommands.openDrawer(as<'drawer.open'>(), actor);
      return [];
    case 'drawer.drop':
      settlementCommands.dropCash(as<'drawer.drop'>(), actor);
      return [];
    case 'tab.clear':
      tradeCommands.clearTab(as<'tab.clear'>(), actor);
      return [];
    case 'order.deliver':
      tradeCommands.deliverOrder(as<'order.deliver'>(), actor);
      return [];
    case 'tab.bill':
      tradeCommands.askForBill(as<'tab.bill'>(), actor);
      return [];
  }
}

/* -------------------------------------------------------------- change feed */

export interface TradeRows {
  tabs: unknown[];
  seats: unknown[];
  orders: unknown[];
  lines: unknown[];
  lineModifiers: unknown[];
  bills: unknown[];
  billLines: unknown[];
  tenders: unknown[];
  drawers: unknown[];
}

const empty = (): TradeRows => ({ tabs: [], seats: [], orders: [], lines: [], lineModifiers: [], bills: [], billLines: [], tenders: [], drawers: [] });

/** Rows a device must hold, by id, as the device may see them: drawers are always the blind view. */
function rowsFor(ids: Map<SyncTable, Set<string>>, deviceId: string | null): TradeRows {
  const data = dataset();
  const pick = <T extends { id: string }>(table: SyncTable, rows: readonly T[]) => {
    const want = ids.get(table);
    return want ? rows.filter((r) => want.has(r.id)) : [];
  };
  return {
    tabs: pick('tabs', data.tabs),
    seats: pick('seats', data.seats),
    orders: pick('orders', data.orders),
    lines: pick('lines', data.lines),
    lineModifiers: pick('lineModifiers', data.lineModifiers),
    bills: pick('bills', data.bills),
    billLines: pick('billLines', data.billLines),
    tenders: pick('tenders', data.tenders),
    drawers: pick('drawerSessions', data.drawerSessions)
      .filter((s) => s.deviceId === deviceId)
      .map((s) => settlement.drawerProjection(s)),
  };
}

export function changesSince(since: number, deviceId: string | null): { cursor: number; rows: TradeRows } {
  return { cursor: currentSeq(), rows: rowsFor(changedSince(since), deviceId) };
}

/**
 * What a device needs the first time it connects, or after a new epoch: every open tab with its
 * seats, orders, lines and modifiers, the bills already taken against those tabs, today's bills on
 * this device, and this device's open drawer.
 */
export function bootstrap(deviceId: string | null): { cursor: number; rows: TradeRows } {
  const rows = empty();
  const data = dataset();
  const open = trade.openTabs();
  // Paid tabs whose guests are still seated hold their table, so a fresh device must see them too.
  const seated = trade.seatedTabs();
  const tabIds = new Set([...open.map((s) => s.tab.id), ...seated.map((t) => t.id)]);
  rows.tabs = [...open.map((s) => s.tab), ...seated];
  rows.seats = data.seats.filter((s) => tabIds.has(s.tabId));
  rows.orders = data.orders.filter((o) => tabIds.has(o.tabId));
  rows.lines = data.lines.filter((l) => tabIds.has(l.tabId));
  const lineIds = new Set((rows.lines as { id: string }[]).map((l) => l.id));
  rows.lineModifiers = data.lineModifiers.filter((m) => lineIds.has(m.orderLineId));

  const current = data.currentBusinessDate;
  const bills = data.bills.filter((b) => (b.tabId !== null && tabIds.has(b.tabId)) || (b.deviceId === deviceId && b.businessDate === current));
  const billIds = new Set(bills.map((b) => b.id));
  rows.bills = bills;
  rows.billLines = data.billLines.filter((l) => billIds.has(l.billId));
  rows.tenders = data.tenders.filter((t) => billIds.has(t.billId));
  rows.drawers = deviceDrawers(deviceId);
  return { cursor: currentSeq(), rows };
}

/**
 * This device's drawer: the one it has open, and any it closed today. Small, and sent with every
 * pull rather than only at bootstrap, because a device's first pull happens before it is bound to a
 * device id: sent only then, the drawer reached nobody, and a counter set up on a fresh browser
 * showed "not open" over a drawer the server had open, and let a second one be opened on top.
 */
export function deviceDrawers(deviceId: string | null): unknown[] {
  if (!deviceId) return [];
  const data = dataset();
  const current = data.currentBusinessDate;
  return data.drawerSessions.filter((s) => s.deviceId === deviceId && (s.status !== 'closed' || s.businessDate === current)).map((s) => settlement.drawerProjection(s));
}
