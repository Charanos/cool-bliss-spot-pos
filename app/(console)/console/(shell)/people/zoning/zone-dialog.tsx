'use client';

import type { Zone } from '@bliss/shared/domain';
import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { createZone, updateZone } from '../../_actions/people';

/** Add or edit a zone. The form resets to the zone being edited each time it opens. */
export function ZoneDialog({ target, priceLists, open, onClose }: { target: Zone | null; priceLists: { value: string; label: string }[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [listId, setListId] = useState('');
  const [status, setStatus] = useState<Zone['status']>('active');
  const editing = Boolean(target);

  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? '');
    setSortOrder(String(target?.sortOrder ?? 0));
    setListId(target?.defaultPriceListId ?? '');
    setStatus(target?.status ?? 'active');
    setError('');
  }, [open, target]);

  function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    startTransition(async () => {
      const form = {
        name: name.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        defaultPriceListId: listId || null,
      };
      const result = editing && target ? await updateZone({ zoneId: target.id, status, ...form }) : await createZone(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={editing ? `Edit ${target?.name ?? 'the zone'}` : 'Add a zone'} description="Tablets show the change on their next sync." width="md">
      <form onSubmit={save} className="flex flex-col gap-24">
        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Terrace" autoComplete="off" required />
        <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
          <SelectField
            label="Price list"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            options={[{ value: '', label: 'The outlet default' }, ...priceLists]}
            helper="What a tab opened here is charged."
          />
          <TextField
            label="Order on the floor"
            type="number"
            inputMode="numeric"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            helper="Lower numbers come first."
            required
          />
        </div>
        {editing ? (
          <SelectField
            label="State"
            value={status}
            onChange={(e) => setStatus(e.target.value as Zone['status'])}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived, hidden from the floor' },
            ]}
          />
        ) : null}
        <div className="flex justify-end gap-12 border-t border-rule pt-16">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {editing ? 'Save changes' : 'Add zone'}
          </Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}
