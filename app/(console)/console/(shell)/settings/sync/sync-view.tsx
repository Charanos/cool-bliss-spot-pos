'use client';

import { formatDateTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Section } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { IconAlertOctagon, IconCheck, IconChecks, IconCloudOff, IconWifiOff } from '@tabler/icons-react';
import { useState } from 'react';
import { ResolveDeadLetterDialog } from '../../_components/dialogs';
import { EntityLink } from '../../_components/entity-link';

export interface DeadLetterRow {
  id: string;
  device: string;
  deviceId: string;
  kind: string;
  what: string;
  code: string;
  detail: string;
  firstSeenAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
  note: string | null;
}

/** What a device could not send, until a person deals with it, and what was done about the rest. */
export function SyncView({ rows, timezone, canResolve, held, offline }: { rows: DeadLetterRow[]; timezone: string; canResolve: boolean; held: number; offline: number }) {
  const [resolving, setResolving] = useState<{ id: string; title: string } | null>(null);
  const open = rows.filter((r) => r.resolvedAt === null);
  const done = rows.filter((r) => r.resolvedAt !== null);

  return (
    <div className="flex flex-col gap-40">
      <MetricGrid>
        <Metric label="Could not be sent" icon={IconAlertOctagon} tone={open.length > 0 ? 'stop' : 'poured'} value={<CountUp value={open.length} />} detail={open.length > 0 ? 'Waiting on a person' : 'Nothing waiting'} />
        <Metric label="Resolved" icon={IconChecks} value={<CountUp value={done.length} delayMs={60} />} detail="Each with what was done" />
        <Metric label="Held on devices" icon={IconCloudOff} tone={held > 0 ? 'attention' : 'default'} value={<CountUp value={held} delayMs={120} />} detail={held > 0 ? 'Sent when they reconnect' : 'Every device has sent everything'} />
        <Metric label="Offline now" icon={IconWifiOff} tone={offline > 0 ? 'attention' : 'default'} href="/console/settings/devices" value={<CountUp value={offline} delayMs={180} />} detail={offline > 0 ? 'They keep working, and send later' : 'Every device is connected'} />
      </MetricGrid>

      <Section
        id="sync-open"
        title={open.length === 0 ? 'Nothing waiting' : `${open.length} could not be sent`}
        description="When a tablet sends something the server cannot accept, it stays here with the reason until someone writes down what was done."
      >
        {open.length === 0 ? (
          <EmptyState title="Every order reached the server" body="Nothing from any device is waiting on a person." />
        ) : (
          <Card>
            <ul className="flex flex-col">
              {open.map((r) => (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-16 border-b border-rule px-20 py-16 last:border-b-0">
                  <div className="flex min-w-0 gap-12">
                    <span className="pt-6">
                      <Dot tone="stop" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-ui font-medium text-ink">
                        {r.kind} from{' '}
                        <EntityLink kind="device" id={r.deviceId}>
                          {r.device}
                        </EntityLink>
                        {r.what ? `, ${r.what}` : ''}
                      </p>
                      <p className="mt-2 text-body-sm text-ink-muted">
                        <span className="text-stop">{r.code}.</span> {r.detail}.
                      </p>
                      <p className="mt-2 text-body-sm text-ink-subtle">
                        First tried <span className="font-mono tabular">{formatDateTime(r.firstSeenAt, timezone)}</span>
                      </p>
                    </div>
                  </div>
                  {canResolve ? (
                    <Button variant="secondary" size="sm" icon={IconCheck} onClick={() => setResolving({ id: r.id, title: `the ${r.kind.toLowerCase()} from ${r.device}` })}>
                      Mark resolved
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      {done.length > 0 ? (
        <Section id="sync-done" title="Resolved" description="What was done about each one, and by whom.">
          <Card>
            <ul className="flex flex-col">
              {done.map((r) => (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-body-sm text-ink-muted">
                      {r.kind} from {r.device}: {r.detail}
                    </p>
                    <p className="mt-2 text-ui text-ink">{r.note}</p>
                    <p className="mt-2 text-body-sm text-ink-subtle">
                      {r.resolvedBy}, <span className="font-mono tabular">{r.resolvedAt ? formatDateTime(r.resolvedAt, timezone) : ''}</span>
                    </p>
                  </div>
                  <StatusChip status="resolved" />
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <ResolveDeadLetterDialog target={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}
