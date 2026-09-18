'use client';

import type { AuditSeverity } from '@bliss/shared/domain';
import { formatDateTime } from '@bliss/shared/format';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { Dot } from '@bliss/ui/components/status';
import { IconFileSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { UrlSelect } from '../../_components/url-select';

export interface AuditRow {
  id: string;
  at: number;
  action: string;
  label: string;
  family: string;
  entityType: string;
  actor: string;
  actorId: string;
  device: string | null;
  severity: AuditSeverity;
  reason: string | null;
  before: string | null;
  after: string | null;
}

const SEVERITY: Record<AuditSeverity, { label: string; tone: 'neutral' | 'low' | 'stop' }> = {
  info: { label: 'Routine', tone: 'neutral' },
  notable: { label: 'Notable', tone: 'low' },
  sensitive: { label: 'Sensitive', tone: 'stop' },
};

/** Before and after are stored as recorded. Shown as key and value lines rather than raw JSON. */
function Snapshot({ json }: { json: string | null }) {
  if (!json) return <p className="text-body text-ink-subtle">Nothing</p>;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return <p className="font-mono text-num-sm text-ink">{json}</p>;
  }
  if (value === null || typeof value !== 'object') return <p className="font-mono text-num-sm text-ink">{String(value)}</p>;
  return (
    <dl className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-12 gap-y-4">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-body-sm text-ink-subtle">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
          <dd className="break-all font-mono tabular text-num-sm text-ink">{Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditTable({
  rows,
  timezone,
  rangeKey,
  rangeOptions,
  families,
  actors,
  exportDate,
}: {
  rows: AuditRow[];
  timezone: string;
  rangeKey: string;
  rangeOptions: { value: string; label: string }[];
  families: { value: string; label: string }[];
  actors: { value: string; label: string }[];
  exportDate: string;
}) {
  const [open, setOpen] = useState<AuditRow | null>(null);

  const columns: Column<AuditRow>[] = [
    { key: 'at', header: 'When', width: '150px', fixed: true, sortValue: (r) => r.at, csv: (r) => new Date(r.at).toISOString(), cell: (r) => <NumCell tone="muted">{formatDateTime(r.at, timezone)}</NumCell> },
    {
      key: 'action',
      header: 'What',
      width: 'minmax(180px,1.2fr)',
      sortValue: (r) => r.label,
      csv: (r) => r.action,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-8">
          <Dot tone={SEVERITY[r.severity].tone} />
          <StackCell primary={r.label} secondary={SEVERITY[r.severity].label} />
        </span>
      ),
    },
    { key: 'actor', header: 'Who', width: '120px', sortValue: (r) => r.actor, csv: (r) => r.actor, cell: (r) => <StackCell primary={r.actor} secondary={r.device ?? undefined} /> },
    { key: 'reason', header: 'Reason given', width: 'minmax(220px,2fr)', wrap: true, csv: (r) => r.reason ?? '', cell: (r) => <span className="text-body text-ink-muted">{r.reason ?? <span className="text-ink-subtle">··</span>}</span> },
    { key: 'before', header: 'Before', width: '0px', exportOnly: true, csv: (r) => r.before ?? '', cell: () => null },
    { key: 'after', header: 'After', width: '0px', exportOnly: true, csv: (r) => r.after ?? '', cell: () => null },
  ];

  return (
    <>
      <DataTable
        id="settings-audit"
        caption="Audit trail"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'at', dir: 'desc' }}
        leading={<UrlSelect param="range" label="Range" options={rangeOptions} allLabel={null} fallback={rangeKey} />}
        search={{ placeholder: 'Search reasons', test: (r, q) => (r.reason ?? '').toLowerCase().includes(q) || r.label.toLowerCase().includes(q) }}
        filters={[
          { kind: 'select', key: 'family', label: 'Kind', options: families, test: (r, v) => r.family === v },
          { kind: 'select', key: 'actor', label: 'Who', options: actors, test: (r, v) => r.actorId === v },
          {
            kind: 'chips',
            key: 'severity',
            label: 'Severity',
            options: [
              { value: 'sensitive', label: 'Sensitive' },
              { value: 'notable', label: 'Notable' },
            ],
            test: (r, v) => r.severity === v,
          },
        ]}
        rowActions={(r) => [{ key: 'open', label: 'See before and after', icon: IconFileSearch, onSelect: () => setOpen(r) }]}
        exportName="audit"
        exportDate={exportDate}
        empty={{ title: 'Nothing recorded in this range', body: 'Every price change, void, write-off, hold and permission change is recorded here.' }}
      />
      <ConsoleOverlay open={Boolean(open)} onClose={() => setOpen(null)} title={open?.label ?? ''} description={open ? `${open.actor}${open.device ? ` on ${open.device}` : ''}, ${formatDateTime(open.at, timezone)}` : undefined} width="md" placement="side">
        {open ? (
          <div className="flex flex-col gap-20 pb-16">
            {open.reason ? (
              <div>
                <h3 className="text-label text-ink-subtle">Reason given</h3>
                <p className="mt-4 text-body text-ink">{open.reason}</p>
              </div>
            ) : null}
            <div>
              <h3 className="text-label text-ink-subtle">Before</h3>
              <div className="mt-4">
                <Snapshot json={open.before} />
              </div>
            </div>
            <div>
              <h3 className="text-label text-ink-subtle">After</h3>
              <div className="mt-4">
                <Snapshot json={open.after} />
              </div>
            </div>
            <p className="font-mono text-num-sm text-ink-subtle">
              {open.entityType} · {open.action}
            </p>
          </div>
        ) : null}
      </ConsoleOverlay>
    </>
  );
}
