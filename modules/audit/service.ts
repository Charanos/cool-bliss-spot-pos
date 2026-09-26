import 'server-only';

import type { AuditEvent, AuditSeverity } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { auditTables } from './schema';

const nextId = createUuidV7();

export interface RecordInput {
  outletId: string;
  actorStaffId: string;
  actorDeviceId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  severity: AuditSeverity;
}

/** One record() interface for every state change. docs/09 Phase 1, AUDIT. Immutable audit trail. */
export function record(input: RecordInput): AuditEvent {
  const event: AuditEvent = Object.freeze({
    id: nextId(),
    outletId: input.outletId,
    occurredAt: Date.now(),
    actorStaffId: input.actorStaffId,
    actorDeviceId: input.actorDeviceId ?? null,
    actorIp: null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: Object.freeze(input.before ? JSON.parse(JSON.stringify(input.before)) : null),
    after: Object.freeze(input.after ? JSON.parse(JSON.stringify(input.after)) : null),
    reason: input.reason,
    severity: input.severity,
  });
  // Append-only: never edited, never removed. Appending (not prepending) keeps every stored row where
  // it is, so a write persists one new row instead of renumbering the whole log. Readers sort.
  auditTables().events.push(event);
  return event;
}

export interface AuditFilter {
  from?: number;
  to?: number;
  action?: string | null;
  actorStaffId?: string | null;
  severity?: AuditSeverity | null;
}

/** Newest first. Ids are uuidv7, so they break ties between events in the same millisecond in order. */
function newestFirst(a: AuditEvent, b: AuditEvent): number {
  return b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

export function list(filter: AuditFilter = {}): AuditEvent[] {
  return auditTables()
    .events.filter(
    (e) =>
      (filter.from === undefined || e.occurredAt >= filter.from) &&
      (filter.to === undefined || e.occurredAt < filter.to) &&
      (!filter.action || e.action.startsWith(filter.action)) &&
      (!filter.actorStaffId || e.actorStaffId === filter.actorStaffId) &&
      (!filter.severity || e.severity === filter.severity),
    )
    .sort(newestFirst);
}

export function actions(): string[] {
  return [...new Set(auditTables().events.map((e) => e.action))].sort();
}
