'use client';

import { Button } from '@bliss/ui/components/button';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { TextField } from '@bliss/ui/components/fields';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { plural } from '@bliss/shared/format';
import { IconUsersMinus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { leaveAllExceptMe } from '../../_actions/people';

/** Start the team again, owners only: everyone else has left, and you stay. Says what stays; asks for RESET and a reason. */
export function LeaveAll({ others, me }: { others: number; me: string }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (others === 0) return null;

  return (
    <Card aria-labelledby="leave-all" tone="stop">
      <CardHeader band level="h2" titleId="leave-all" icon={IconUsersMinus} title="Start the team again" subtitle={`Keep ${me}, and everyone else leaves`} />
      <div className="flex flex-col gap-16 px-20 py-20">
        <p className="measure text-body text-ink-muted">
          {plural(others, 'other person', 'other people')} will be marked as having left, and their sign-ins end at once. What they served, poured and were paid for stays on the record, and so does the audit trail. Devices, zones, tables, the menu
          and stock are untouched. A person who returns is added again as someone new. It cannot be undone.
        </p>
        {!open ? (
          <Button variant="destructive" icon={IconUsersMinus} onClick={() => setOpen(true)} className="self-start">
            Start the team again
          </Button>
        ) : (
          <div className="flex max-w-[560px] flex-col gap-16">
            <TextField label="Type RESET to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" mono />
            {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
            <ReasonForm
              quickReasons={['Clearing the trial team before the real one is added', 'Starting the team again from the owner']}
              confirmLabel="Everyone else leaves"
              cancelLabel="Keep the team"
              onCancel={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              onConfirm={async ({ reason }) => {
                setError(null);
                const result = await leaveAllExceptMe({ confirm, reason });
                if (!result.ok) {
                  setError(result.message);
                  throw new Error(result.message);
                }
                notify({ title: `${plural(result.left, 'person', 'people')} left`, body: `${me} is the only one who can sign in now.` });
                setOpen(false);
                setConfirm('');
                router.refresh();
              }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
