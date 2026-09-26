'use client';

import type { ServiceTable, Zone } from '@bliss/shared/domain';
import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { createServiceTable, updateServiceTable } from '../../_actions/people';
import { useToast } from '@bliss/ui/components/console/toast';

/**
 * Add or edit a table. Occupied is not a choice: a table is occupied while a tab is open on it, and
 * only settling or moving that tab frees it.
 */
export function TableDialog({ target, zones, open, onClose }: { target: ServiceTable | null; zones: Zone[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [seats, setSeats] = useState('4');
  const [status, setStatus] = useState<ServiceTable['status']>('available');
  const editing = Boolean(target);
  const occupied = target?.status === 'occupied';
  const activeZones = zones.filter((z) => z.status === 'active' || z.id === target?.zoneId);

  useEffect(() => {
    if (!open) return;
    setLabel(target?.label ?? '');
    setZoneId(target?.zoneId ?? activeZones[0]?.id ?? '');
    setSeats(String(target?.seats ?? 4));
    setStatus(target?.status ?? 'available');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the dialog opens on a target
  }, [open, target]);

  function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      const form = {
        label: label.trim(),
        zoneId,
        seats: Number.parseInt(seats, 10) || 0,
        positionX: target?.positionX ?? 0,
        positionY: target?.positionY ?? 0,
      };
      const result = editing && target ? await updateServiceTable({ tableId: target.id, status, ...form }) : await createServiceTable(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      notify({ title: target ? 'Table saved' : 'Table added' });
      router.refresh();
    });
  }

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={editing ? `Edit ${target?.label ?? 'the table'}` : 'Add a table'} description="Tablets show the change on their next sync." width="md">
      <form onSubmit={save} className="flex flex-col gap-24">
        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
        <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          <TextField label="Name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="T12" autoComplete="off" required />
          <SelectField label="Zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} options={activeZones.map((z) => ({ value: z.id, label: z.name }))} required />
        </div>
        <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          <TextField label="Seats" type="number" inputMode="numeric" min={1} max={40} value={seats} onChange={(e) => setSeats(e.target.value)} required />
          {editing ? (
            occupied ? (
              <TextField label="State" value="Occupied, a tab is open" readOnly helper="Settle or move the tab to change this." />
            ) : (
              <SelectField
                label="State"
                value={status}
                onChange={(e) => setStatus(e.target.value as ServiceTable['status'])}
                options={[
                  { value: 'available', label: 'Available' },
                  { value: 'out_of_service', label: 'Out of service' },
                ]}
              />
            )
          ) : null}
        </div>
        <div className="flex justify-end gap-12 border-t border-rule pt-16">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? 'Save changes' : 'Add table'}
          </Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}
