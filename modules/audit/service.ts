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

/** One record() interface for every state change. docs/09 Phase 1, AUDIT. */
export function record(input: RecordInput): AuditEvent {
  const event: AuditEvent = {
    id: nextId(),
    outletId: input.outletId,
    occurredAt: Date.now(),
    actorStaffId: input.actorStaffId,
    actorDeviceId: input.actorDeviceId ?? null,
    actorIp: null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    reason: input.reason,
    severity: input.severity,
  };
  // Append only: newest first, never edited, never removed.
  auditTables().events.unshift(event);
  return event;
}

export interface AuditFilter {
  from?: number;
  to?: number;
  action?: string | null;
  actorStaffId?: string | null;
  severity?: AuditSeverity | null;
}

export function list(filter: AuditFilter = {}): AuditEvent[] {
  return auditTables().events.filter(
    (e) =>
      (filter.from === undefined || e.occurredAt >= filter.from) &&
      (filter.to === undefined || e.occurredAt < filter.to) &&
      (!filter.action || e.action.startsWith(filter.action)) &&
      (!filter.actorStaffId || e.actorStaffId === filter.actorStaffId) &&
      (!filter.severity || e.severity === filter.severity),
  );
}

export function actions(): string[] {
  return [...new Set(auditTables().events.map((e) => e.action))].sort();
}
