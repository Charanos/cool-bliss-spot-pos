import 'server-only';

import type { RoleKey, Shift } from '@bliss/shared/domain';
import { type Cents, ZERO, add } from '@bliss/shared/money';
import { businessDate } from '@bliss/shared/time';
import { createUuidV7 } from '@bliss/shared/id';
import * as audit from '../audit/service';
import { outlet } from '../identity/service';
import * as settlement from '../settlement/service';
import { tradeTables } from './schema';

const createId = createUuidV7();

/**
 * Shifts: who worked, when, on which station, and what went through their hands. docs/14 section 1.
 *
 * A shift starts when someone signs in on a Floor tablet or the Counter and has no shift running on
 * that business day; signing in again on another station, or after a reload, joins the same shift.
 * It ends when they sign out or hand their tables over at the end of the night. One left running (a
 * tablet put down, a day that closed) stays open until a manager ends it in the Console, which says
 * so, rather than being closed at a guessed time.
 *
 * The figures of a running shift are worked out as they are read, from the tabs, bills and voids in
 * its window; a shift that ends keeps the figures it had at that moment, so a later correction to a
 * bill does not rewrite what someone sold on the night.
 */

function openShiftOf(staffId: string): Shift | null {
  const open = tradeTables().shifts.filter((s) => s.staffId === staffId && s.status === 'open');
  return open.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

/** What went through a person's hands between the start of a shift and its end, or now. */
export function shiftFigures(shift: Pick<Shift, 'staffId' | 'startedAt' | 'endedAt' | 'businessDate'>, now = Date.now()) {
  const until = shift.endedAt ?? now;
  const within = (at: number | null | undefined) => typeof at === 'number' && at >= shift.startedAt && at <= until;
  const { tabs, lines } = tradeTables();

  const tabsOpened = tabs.filter((t) => t.openedBy === shift.staffId && within(t.openedAt)).length;
  const theirTabs = new Set(tabs.filter((t) => t.assignedTo === shift.staffId || t.openedBy === shift.staffId).map((t) => t.id));

  // A bill counts once: on the waiter whose table it was, or the cashier who took it.
  let sales: Cents = ZERO;
  let discounts: Cents = ZERO;
  const lastDay = businessDate(until, outlet().timezone, outlet().businessDayCutover);
  for (const bill of settlement.billsBetween(shift.businessDate, lastDay)) {
    if (bill.status === 'voided' || !within(bill.settledAt)) continue;
    const mine = bill.settledBy === shift.staffId || (bill.tabId !== null && theirTabs.has(bill.tabId));
    if (!mine) continue;
    sales = add(sales, settlement.billNet(bill));
    if (bill.settledBy === shift.staffId) discounts = add(discounts, bill.discountCents);
  }

  let voids: Cents = ZERO;
  for (const line of lines) if (line.status === 'voided' && line.voidedBy === shift.staffId && within(line.voidedAt)) voids = add(voids, line.lineTotalCents);

  return { tabsOpened, salesCents: sales, voidsCents: voids, discountsCents: discounts };
}

/** A shift as the Console shows it: a running one with its figures as they stand. */
export function withFigures(shift: Shift, now = Date.now()): Shift {
  return shift.status === 'open' ? { ...shift, ...shiftFigures(shift, now) } : shift;
}

/**
 * Someone signed in on a station. Joins their running shift for this business day, or starts one.
 * A shift still running from an earlier day is left for a manager to end: it is not closed at a
 * time nobody recorded.
 */
export function startShift(input: { staffId: string; roleKey: RoleKey; deviceId: string; at?: number }): Shift {
  const at = input.at ?? Date.now();
  const o = outlet();
  const today = businessDate(at, o.timezone, o.businessDayCutover);
  const running = openShiftOf(input.staffId);
  if (running && running.businessDate === today) return running;

  const shift: Shift = {
    id: createId(),
    outletId: o.id,
    businessDate: today,
    staffId: input.staffId,
    roleAtShift: input.roleKey,
    startedAt: at,
    endedAt: null,
    handoverTo: null,
    handoverAt: null,
    tabsOpened: 0,
    tabsHandedOver: 0,
    salesCents: ZERO,
    voidsCents: ZERO,
    discountsCents: ZERO,
    status: 'open',
  };
  tradeTables().shifts.push(shift);
  audit.record({ outletId: o.id, actorStaffId: input.staffId, actorDeviceId: input.deviceId, action: 'shift.started', entityType: 'shift', entityId: shift.id, before: null, after: { businessDate: today }, reason: null, severity: 'info' });
  return shift;
}

/** Someone signed out, or handed their tables over at the end of the night. Keeps the figures as they stand. */
export function endShift(input: { staffId: string; deviceId: string | null; at?: number }): Shift | null {
  const shift = openShiftOf(input.staffId);
  if (!shift) return null;
  const at = Math.max(input.at ?? Date.now(), shift.startedAt);
  Object.assign(shift, shiftFigures({ ...shift, endedAt: at }), { endedAt: at, status: 'closed' as const });
  audit.record({ outletId: shift.outletId, actorStaffId: input.staffId, actorDeviceId: input.deviceId, action: 'shift.ended', entityType: 'shift', entityId: shift.id, before: { status: 'open' }, after: { status: 'closed', endedAt: at }, reason: null, severity: 'info' });
  return shift;
}

/** Tables handed to someone else: counted on the running shift, and who took them last is kept. */
export function noteHandover(input: { fromStaffId: string; toStaffId: string; tabs: number; at?: number }): void {
  const shift = openShiftOf(input.fromStaffId);
  if (!shift || input.tabs <= 0) return;
  shift.tabsHandedOver += input.tabs;
  shift.handoverTo = input.toStaffId;
  shift.handoverAt = input.at ?? Date.now();
}
