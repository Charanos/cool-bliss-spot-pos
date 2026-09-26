'use client';

import { formatKes, multiplyByQuantity } from '@bliss/shared/money';
import type { Cents } from '@bliss/shared/money';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { useRouter } from 'next/navigation';
import { useToast } from '@bliss/ui/components/console/toast';
import { useState } from 'react';
import { placeHold, releaseHold, writeOff } from '../_actions/inventory';
import { resolveDeadLetter, withdrawDevice } from '../_actions/settings';
import type { ActionResult } from '../_lib/action-result';

async function settle(result: Promise<ActionResult>, after: () => void) {
  const r = await result;
  if (!r.ok) throw new Error(r.message);
  after();
}

export function HoldDialog({ target, onClose }: { target: { variantId: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  const [expectedBack, setExpectedBack] = useState('');
  return (
    <ConsoleOverlay open={Boolean(target)} onClose={onClose} title={target ? `Put ${target.name} on hold?` : ''} description="The floor stops being able to sell it straight away." width="md">
      {target ? (
        <ReasonForm
          key={target.variantId}
          quickReasons={['Bottle broke', 'Not delivered', 'Quality issue']}
          confirmLabel="Put on hold"
          onCancel={onClose}
          onConfirm={({ reason }) =>
            settle(placeHold({ variantId: target.variantId, reason, expectedBack: expectedBack || null }), () => {
              notify({ title: `${target.name} is on hold` });
              onClose();
              router.refresh();
            })
          }
        >
          <div className="pb-16">
            <TextField type="date" label="Expected back (optional)" value={expectedBack} onChange={(e) => setExpectedBack(e.target.value)} size="md" />
          </div>
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}

export function ReleaseHoldDialog({ target, onClose }: { target: { holdId: string; name: string } | null; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  return (
    <ConsoleOverlay open={Boolean(target)} onClose={onClose} title={target ? `Take ${target.name} off hold?` : ''} description="The floor can sell it again straight away." width="md">
      {target ? (
        <ReasonForm
          key={target.holdId}
          destructive={false}
          quickReasons={['Delivery arrived', 'Checked and fine', 'Replaced the bottle']}
          confirmLabel="Take off hold"
          onCancel={onClose}
          onConfirm={({ reason }) =>
            settle(releaseHold({ holdId: target.holdId, note: reason }), () => {
              notify({ title: `${target.name} is back on sale` });
              onClose();
              router.refresh();
            })
          }
        />
      ) : null}
    </ConsoleOverlay>
  );
}

const WRITE_OFF_CATEGORIES = [
  { value: 'write_off_breakage', label: 'Breakage' },
  { value: 'write_off_spillage', label: 'Spillage' },
  { value: 'write_off_expiry', label: 'Expiry' },
  { value: 'staff_drink', label: 'Staff drink' },
  { value: 'comp', label: 'Comp' },
] as const;

export function WriteOffDialog({
  target,
  locations,
  onClose,
}: {
  target: { variantId: string; name: string; unitCost: Cents; locationId: string; unit: string } | null;
  locations: { value: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const notify = useToast();
  const [qty, setQty] = useState('1');
  const [category, setCategory] = useState<(typeof WRITE_OFF_CATEGORIES)[number]['value']>('write_off_breakage');
  const [locationId, setLocationId] = useState(target?.locationId ?? '');
  const amount = Number(qty);
  const valid = Number.isFinite(amount) && amount > 0;
  const value = target && valid ? multiplyByQuantity(target.unitCost, amount) : null;
  return (
    <ConsoleOverlay
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `Write off ${valid ? amount : ''} × ${target.name}?` : ''}
      description={value ? `This removes ${formatKes(value)} of stock at cost and shows in tonight's variance.` : 'Enter how much to write off.'}
      width="md"
    >
      {target ? (
        <ReasonForm
          key={target.variantId}
          quickReasons={['Bottle broke', 'Spilled during service', 'Past its date']}
          confirmLabel="Write off"
          onCancel={onClose}
          onConfirm={({ reason }) => {
            if (!valid) throw new Error(`Write off at least part of one ${target.unit.replace(/s$/, '')}.`);
            return settle(writeOff({ variantId: target.variantId, locationId: locationId || target.locationId, qty: amount, category, reason }), () => {
              notify({ title: `${target.name} written off` });
              onClose();
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-3 gap-16 pb-16">
            <TextField label={`Quantity (${target.unit})`} inputMode="decimal" mono size="md" value={qty} onChange={(e) => setQty(e.target.value)} />
            <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} options={WRITE_OFF_CATEGORIES} />
            <SelectField label="Location" value={locationId || target.locationId} onChange={(e) => setLocationId(e.target.value)} options={locations} />
          </div>
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}

export function WithdrawDeviceDialog({ target, onClose }: { target: { deviceId: string; label: string } | null; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  return (
    <ConsoleOverlay
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `Withdraw ${target.label}?` : ''}
      description={target ? `${target.label} stops working within a minute. Any orders it is holding can still be recovered.` : undefined}
      width="md"
    >
      {target ? (
        <ReasonForm
          key={target.deviceId}
          quickReasons={['Tablet lost', 'Tablet stolen', 'Tablet broken']}
          confirmLabel={`Withdraw ${target.label}`}
          onCancel={onClose}
          onConfirm={({ reason }) =>
            settle(withdrawDevice({ deviceId: target.deviceId, reason }), () => {
              notify({ title: `${target.label} withdrawn` });
              onClose();
              router.refresh();
            })
          }
        />
      ) : null}
    </ConsoleOverlay>
  );
}

export function ResolveDeadLetterDialog({ target, onClose }: { target: { id: string; title: string } | null; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  return (
    <ConsoleOverlay
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `Mark ${target.title} as resolved?` : ''}
      description="Write what was done, so the next person knows nothing was lost."
      width="md"
    >
      {target ? (
        <ReasonForm
          key={target.id}
          destructive={false}
          quickReasons={['Re-entered at the counter', 'Lines moved by hand', 'Duplicate, nothing lost']}
          confirmLabel="Mark resolved"
          onCancel={onClose}
          onConfirm={({ reason }) =>
            settle(resolveDeadLetter({ id: target.id, reason }), () => {
              notify({ title: 'Marked resolved' });
              onClose();
              router.refresh();
            })
          }
        />
      ) : null}
    </ConsoleOverlay>
  );
}
