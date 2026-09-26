'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import type { ActionItem } from '@bliss/ui/components/action-list';
import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { IconArrowBackUp, IconDeviceTabletOff, IconKey, IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { newPairingCode, registerDevice, reinstateDevice, renameDevice } from '../../_actions/venue';
import { WithdrawDeviceDialog } from '../../_components/dialogs';
import { FormDialog, OneTimeCode, ReasonDialog, useCreateParam } from '../../_components/forms';

export type DeviceKind = 'floor' | 'counter' | 'bar';

export interface ManagedDevice {
  id: string;
  label: string;
  status: DeviceStatus;
}

type Open = { kind: 'register' } | { kind: 'rename' | 'withdraw' | 'reinstate' | 'code'; device: ManagedDevice } | { kind: 'show'; label: string; code: string } | null;

const KIND_OPTIONS: { value: DeviceKind; label: string }[] = [
  { value: 'floor', label: 'Floor tablet' },
  { value: 'counter', label: 'Counter' },
  { value: 'bar', label: 'Bar screen' },
];

/**
 * Register, rename, withdraw and bring back devices, for the list and the record alike. A new or
 * reinstated device gets a six-digit pairing code, shown here once: the station asks for it the
 * first time it is chosen, so nobody can take over a device by picking it.
 */
export function useDeviceManager({ canManage, createParam = false }: { canManage: boolean; createParam?: boolean }): {
  actions: (d: ManagedDevice) => ActionItem[];
  register: () => void;
  rename: (d: ManagedDevice) => void;
  dialogs: ReactNode;
} {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<DeviceKind>('floor');
  useCreateParam(() => setOpen({ kind: 'register' }), canManage && createParam);
  const device = open && 'device' in open ? open.device : null;

  useEffect(() => {
    if (open?.kind === 'register') {
      setLabel('');
      setKind('floor');
    }
    if (open?.kind === 'rename') setLabel(open.device.label);
  }, [open]);

  const actions = (d: ManagedDevice): ActionItem[] => {
    if (!canManage) return [];
    if (d.status !== 'active') return [{ key: 'reinstate', label: 'Bring it back', icon: IconArrowBackUp, onSelect: () => setOpen({ kind: 'reinstate', device: d }) }];
    return [
      { key: 'rename', label: 'Rename', icon: IconPencil, onSelect: () => setOpen({ kind: 'rename', device: d }) },
      { key: 'code', label: 'A new pairing code', icon: IconKey, onSelect: () => setOpen({ kind: 'code', device: d }) },
      { key: 'withdraw', label: `Withdraw ${d.label}`, icon: IconDeviceTabletOff, destructive: true, onSelect: () => setOpen({ kind: 'withdraw', device: d }) },
    ];
  };

  const close = () => setOpen(null);
  const show = (name: string, code: string) => setOpen({ kind: 'show', label: name, code });

  return {
    actions,
    register: () => setOpen({ kind: 'register' }),
    rename: (d) => setOpen({ kind: 'rename', device: d }),
    dialogs: (
      <>
        <FormDialog
          open={open?.kind === 'register'}
          onClose={close}
          width="md"
          title="Register a device"
          description="Name it as the staff will see it on the sign-in screen. A pairing code comes next, for the device itself."
          submitLabel="Register"
          onSubmit={() => registerDevice({ label, kind })}
          onDone={(r) => show(label.trim(), r.pairingCode)}
        >
          <TextField label="Called" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Floor 4" required maxLength={30} />
          <SelectField label="Kind" value={kind} onChange={(e) => setKind(e.target.value as DeviceKind)} options={KIND_OPTIONS} helper="Where it is used decides who can sign in on it." />
        </FormDialog>

        <FormDialog
          open={open?.kind === 'rename'}
          onClose={close}
          width="md"
          title={`Rename ${device?.label ?? 'the device'}`}
          description="Stations show the new name at their next sync."
          submitLabel="Rename"
          onSubmit={() => renameDevice({ deviceId: device!.id, label })}
        >
          <TextField label="Called" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={30} />
        </FormDialog>

        <FormDialog
          open={open?.kind === 'code'}
          onClose={close}
          width="md"
          title={`A new pairing code for ${device?.label ?? 'the device'}?`}
          description="Any code given before stops working. Use this when a code was lost or ran out before the device was paired."
          submitLabel="Show a new code"
          onSubmit={() => newPairingCode({ deviceId: device!.id })}
          onDone={(r) => show(device!.label, r.pairingCode)}
        >
          <p className="text-body-sm text-ink-muted">A device already paired keeps working. It only asks for the code the next time it is chosen.</p>
        </FormDialog>

        <ReasonDialog
          open={open?.kind === 'reinstate'}
          onClose={close}
          title={`Bring ${device?.label ?? 'the device'} back?`}
          description="It must be paired again with a new code before anyone signs in on it."
          confirmLabel="Bring it back"
          destructive={false}
          quickReasons={['Found', 'Repaired', 'Withdrawn by mistake']}
          run={async (reason) => {
            const d = device!;
            const r = await reinstateDevice({ deviceId: d.id, reason });
            if (r.ok) setTimeout(() => show(d.label, r.pairingCode), 0);
            return r;
          }}
        />

        <WithdrawDeviceDialog target={open?.kind === 'withdraw' ? { deviceId: open.device.id, label: open.device.label } : null} onClose={close} />

        <ConsoleOverlay open={open?.kind === 'show'} onClose={close} title={open?.kind === 'show' ? `Pair ${open.label}` : ''} description="Shown once. It works for 24 hours." width="md">
          {open?.kind === 'show' ? (
            <div className="flex flex-col gap-24">
              <OneTimeCode code={open.code}>On {open.label}, choose it on the sign-in screen and enter this code. Nobody can sign in on it until it is paired.</OneTimeCode>
              <div className="flex justify-end border-t border-rule pt-16">
                <Button
                  variant="primary"
                  onClick={() => {
                    close();
                    router.refresh();
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </ConsoleOverlay>
      </>
    ),
  };
}
