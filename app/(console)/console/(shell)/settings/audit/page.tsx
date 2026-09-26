import type { Metadata } from 'next';
import * as audit from '@/modules/audit/service';
import * as identity from '@/modules/identity/service';
import { actionLabel } from '../../_lib/labels';
import { businessRange, rangeOptions } from '../../_lib/range';
import { type AuditRow, AuditTable } from './audit-table';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Audit trail' };

/**
 * N-10: every price change, void, write-off, hold and permission change, with who, when, before,
 * after and why. Append only: this view reads, and nothing anywhere edits or removes a row.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const range = businessRange(params.range, '28');
  const tz = identity.outlet().timezone;
  const devices = identity.devices();
  const rows: AuditRow[] = audit.list({ from: range.start, to: range.end }).map((e) => ({
    id: e.id,
    at: e.occurredAt,
    action: e.action,
    label: actionLabel(e.action),
    family: e.action.split('.')[0] ?? e.action,
    entityType: e.entityType,
    actor: identity.displayName(e.actorStaffId),
    actorId: e.actorStaffId ?? '',
    device: e.actorDeviceId ? (devices.find((d) => d.id === e.actorDeviceId)?.label ?? null) : null,
    severity: e.severity,
    reason: e.reason,
    before: e.before === null || e.before === undefined ? null : JSON.stringify(e.before),
    after: e.after === null || e.after === undefined ? null : JSON.stringify(e.after),
  }));
  const families = [...new Set(rows.map((r) => r.family))].sort().map((f) => ({ value: f, label: actionLabel(f).replace(/^./, (c) => c.toUpperCase()) }));
  const actors = [...new Map(rows.map((r) => [r.actorId, r.actor])).entries()].filter(([id]) => id).map(([value, label]) => ({ value, label }));
  return (
    <>
      <ViewHeader page="/console/settings/audit" />
      <AuditTable rows={rows} timezone={tz} rangeKey={range.key} rangeOptions={rangeOptions(false)} families={families} actors={actors} exportDate={range.to} />
    </>
  );
}
