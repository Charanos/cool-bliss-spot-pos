import 'server-only';

import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { holdsTable } from '@bliss/shared/trade';
import { touch } from '../_data/changes';
import { DomainError } from '../_data/errors';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import * as settlement from '../settlement/service';
import * as commands from './commands';
import { tradeTables } from './schema';

/**
 * What a manager can do to a tab from the Console, docs/19 plan C3. Each goes through the same
 * command a station sends, with the manager as the actor and no device, so the rules (a poured
 * line needs void approval, a settled line cannot be voided) are the station's rules exactly.
 */

const OPEN = new Set(['open', 'part_settled', 'settling']);

function consoleActor(actor: Actor): Actor {
  return { staffId: actor.staffId, deviceId: null };
}

/** Void one line on an open tab. The manager is the approver, so they need `void.approve`. */
export function voidLine(input: { lineId: string; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'void.approve', 'voiding lines');
  commands.voidLine({ v: 1, lineId: input.lineId, reason, approvalToken: null }, consoleActor(actor));
}

/** Move a tab to another table, when the guests have moved. The table must be free. */
export function moveTab(input: { tabId: string; toTableId: string; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'void.approve', 'moving tabs');
  const t = tradeTables();
  const tab = t.tabs.find((x) => x.id === input.tabId);
  if (!tab || !OPEN.has(tab.status)) throw new DomainError('That tab is no longer open.');
  const table = t.tables.find((x) => x.id === input.toTableId);
  if (!table || table.status === 'out_of_service') throw new DomainError('Choose a table that is in service.');
  const taken = t.tabs.find((x) => x.id !== tab.id && x.serviceTableId === table.id && holdsTable(x));
  if (taken) throw new DomainError(`${table.label} already has tab ${taken.tabNumber} on it.`);
  commands.moveTab({ v: 1, tabId: tab.id, fromTableId: tab.serviceTableId, toTableId: table.id }, consoleActor(input.actor));
}

/** Give tabs to another waiter, when one goes home early. */
export function handOver(input: { tabIds: readonly string[]; toStaffId: string; actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'void.approve', 'handing over tabs');
  if (input.tabIds.length === 0) throw new DomainError('Choose at least one tab to hand over.');
  commands.handOver({ v: 1, tabIds: [...input.tabIds], toStaffId: input.toStaffId }, consoleActor(input.actor));
}

/**
 * Close a tab that cannot be closed at the counter: left open from an earlier night, or its guests
 * gone without paying. Every line not yet on a bill is voided with the reason: a poured line was
 * drunk, so its stock stays gone, and one not yet poured goes back on the shelf. The tab closes,
 * settled if bills stand against it and voided if none do, and its table is freed.
 */
export function forceCloseTab(input: { tabId: string; reason: string; actor: Actor }): { voided: number } {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'void.approve', 'closing tabs');
  const t = tradeTables();
  const tab = t.tabs.find((x) => x.id === input.tabId);
  if (!tab) throw new DomainError('That tab does not exist.');
  if (!OPEN.has(tab.status)) throw new DomainError(`Tab ${tab.tabNumber} is already closed.`);
  const billed = settlement.billedLineIds();
  const unbilled = t.lines.filter((l) => l.tabId === tab.id && l.status !== 'voided' && !billed.has(l.id));
  for (const line of unbilled) commands.voidForClose(line.id, reason, consoleActor(actor));
  const before = tab.status;
  const now = Date.now();
  tab.status = settlement.billsForTab(tab.id).length > 0 ? 'settled' : 'voided';
  tab.closedAt = now;
  tab.clearedAt = now;
  tab.clearedBy = actor.staffId;
  for (const seat of t.seats.filter((s) => s.tabId === tab.id && s.status === 'active')) {
    seat.status = 'removed';
    touch('seats', seat.id);
  }
  touch('tabs', tab.id);
  audit.record({
    outletId: tab.outletId,
    actorStaffId: actor.staffId,
    action: 'tab.force_closed',
    entityType: 'tab',
    entityId: tab.id,
    before: { status: before },
    after: { status: tab.status, linesVoided: unbilled.length },
    reason,
    severity: 'sensitive',
  });
  return { voided: unbilled.length };
}

/** End a shift somebody forgot to end, at the time the manager says it ended. */
export function closeShift(input: { shiftId: string; endedAt: number; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'staff.manage', 'closing shifts');
  const shift = tradeTables().shifts.find((s) => s.id === input.shiftId);
  if (!shift) throw new DomainError('That shift does not exist.');
  if (shift.status === 'closed') throw new DomainError('That shift has ended already.');
  if (!Number.isFinite(input.endedAt) || input.endedAt < shift.startedAt || input.endedAt > Date.now()) throw new DomainError('The end is after the start and not in the future.');
  shift.status = 'closed';
  shift.endedAt = input.endedAt;
  audit.record({ outletId: shift.outletId, actorStaffId: actor.staffId, action: 'shift.closed', entityType: 'shift', entityId: shift.id, before: { status: 'open' }, after: { status: 'closed', endedAt: input.endedAt }, reason, severity: 'notable' });
}
