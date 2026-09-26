'use client';

import { formatDateTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card } from '@bliss/ui/components/console/card';
import { Section } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Dot, StatusChip } from '@bliss/ui/components/status';
import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { ResolveDeadLetterDialog } from '../../_components/dialogs';

export interface DeadLetterRow {
  id: string;
  device: string;
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
export function SyncView({ rows, timezone, canResolve }: { rows: DeadLetterRow[]; timezone: string; canResolve: boolean }) {
  const [resolving, setResolving] = useState<{ id: string; title: string } | null>(null);
  const open = rows.filter((r) => r.resolvedAt === null);
  const done = rows.filter((r) => r.resolvedAt !== null);

  return (
    <div className="flex flex-col gap-40">
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
                        {r.kind} from {r.device}
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
