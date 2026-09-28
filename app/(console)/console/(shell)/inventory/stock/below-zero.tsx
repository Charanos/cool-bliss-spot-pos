'use client';

import { plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Callout } from '@bliss/ui/components/console/section';
import { useToast } from '@bliss/ui/components/console/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { coverNegatives } from '../../_actions/inventory';

/**
 * Balances that read below zero, from before stock was kept from going there. A shelf cannot hold
 * less than nothing: what was sold was there and never recorded. One tap brings each back to zero,
 * recorded as sold beyond the record and flagged "Count needed", so the next count finds the truth.
 */
export function BelowZeroNotice({ count }: { count: number }) {
  const router = useRouter();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Callout
      tone="low"
      title={`${plural(count, 'balance')} below zero`}
      action={
        <Button
          variant="outline"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const result = await coverNegatives();
            setBusy(false);
            if (!result.ok) return notify({ tone: 'stop', title: 'That did not go through', body: result.message });
            notify({ title: 'Back to zero', body: 'Each is marked Count needed. A count sets the real figure.' });
            router.refresh();
          }}
        >
          Bring to zero
        </Button>
      }
    >
      More was sold than the record held, before sales stopped short of zero. It was there, just never recorded. Bring these to zero, then count them.
    </Callout>
  );
}
