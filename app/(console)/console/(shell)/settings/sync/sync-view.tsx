'use client';

import { formatDateTime } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { RevealSection } from '@bliss/ui/components/console/shell';
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

export function SyncView({ rows, timezone, canResolve }: { rows: DeadLetterRow[]; timezone: string; canResolve: boolean }) {
  const [resolving, setResolving] = useState<{ id: string; title: string } | null>(null);
  const open = rows.filter((r) => r.resolvedAt === null);
  const done = rows.filter((r) => r.resolvedAt !== null);

  return (
    <>
      <RevealSection aria-labelledby="sync-open">
        <h2 id="sync-open" className="flex items-center gap-8 border-b border-hairline pb-8 text-subtitle text-ink">
          {open.length > 0 ? <Dot tone="stop" /> : null}
          {open.length === 0 ? 'Nothing waiting' : `${open.length} could not be sent`}
        </h2>
        {open.length === 0 ? (
          <EmptyState title="Every order reached the server" body="When a tablet sends something the server cannot accept, it appears here with the reason, until someone deals with it." />
        ) : (
          <ul>
            {open.map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-12 border-b border-rule py-16 tablet:grid-cols-[minmax(0,1fr)_auto] tablet:items-center">
                <div className="min-w-0">
                  <p className="text-body text-ink">
                    {r.kind} from {r.device}
                    {r.what ? `, ${r.what}` : ''}
                  </p>
                  <p className="mt-2 text-body text-ink-muted">
                    <span className="text-stop">{r.code}.</span> {r.detail}.
                  </p>
                  <p className="mt-2 font-mono tabular text-num-sm text-ink-subtle">First tried {formatDateTime(r.firstSeenAt, timezone)}</p>
                </div>
                {canResolve ? (
                  <Button variant="secondary" icon={IconCheck} onClick={() => setResolving({ id: r.id, title: `the ${r.kind.toLowerCase()} from ${r.device}` })}>
                    Mark resolved
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </RevealSection>

      {done.length > 0 ? (
        <RevealSection className="mt-40" aria-labelledby="sync-done">
          <h2 id="sync-done" className="border-b border-hairline pb-8 text-subtitle text-ink">
            Resolved
          </h2>
          <ul>
            {done.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-16 border-b border-rule py-12">
                <div className="min-w-0">
                  <p className="text-body text-ink-muted">
                    {r.kind} from {r.device}: {r.detail}
                  </p>
                  <p className="mt-2 text-body text-ink">{r.note}</p>
                  <p className="mt-2 text-body-sm text-ink-subtle">
                    {r.resolvedBy} · <span className="font-mono tabular text-num-sm">{r.resolvedAt ? formatDateTime(r.resolvedAt, timezone) : ''}</span>
                  </p>
                </div>
                <StatusChip status="resolved" />
              </li>
            ))}
          </ul>
        </RevealSection>
      ) : null}

      <ResolveDeadLetterDialog target={resolving} onClose={() => setResolving(null)} />
    </>
  );
}
