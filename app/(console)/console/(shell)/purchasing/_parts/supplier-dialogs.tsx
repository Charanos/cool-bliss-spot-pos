'use client';

import { type Cents, formatDecimal } from '@bliss/shared/money';
import { SelectField, TextArea, TextField } from '@bliss/ui/components/fields';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { saveSupplier, setSupplierItem } from '../../_actions/purchasing';
import { DaysField, Fieldset, FormDialog } from '../../_components/forms';

export interface SupplierDraft {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  paymentTermsDays: number;
  leadTimeDays: number;
  minOrderCents: Cents;
  deliveryDays: number[];
  notes: string | null;
}

/** Add a supplier, or change one: who to call, their terms, and the days they deliver. */
export function SupplierDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: SupplierDraft | null }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', contact: '', phone: '', email: '', terms: '14', lead: '2', min: '0', days: [] as number[], notes: '' });
  useEffect(() => {
    if (!open) return;
    setF({
      name: target?.name ?? '',
      contact: target?.contactName ?? '',
      phone: target?.phone ?? '',
      email: target?.email ?? '',
      terms: String(target?.paymentTermsDays ?? 14),
      lead: String(target?.leadTimeDays ?? 2),
      min: target ? formatDecimal(target.minOrderCents) : '0',
      days: target?.deliveryDays ?? [],
      notes: target?.notes ?? '',
    });
  }, [open, target]);
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [key]: e.target.value }));
  const editing = Boolean(target);
  return (
    <FormDialog<{ id: string }>
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${target!.name}` : 'Add a supplier'}
      description={editing ? 'Orders already raised keep what they were raised with.' : 'Then say which items they carry, at what cost, on their page.'}
      submitLabel={editing ? 'Save changes' : 'Add supplier'}
      onSubmit={() =>
        saveSupplier({
          id: target?.id ?? null,
          name: f.name,
          contactName: f.contact || null,
          phone: f.phone || null,
          email: f.email || null,
          paymentTermsDays: Number(f.terms),
          leadTimeDays: Number(f.lead),
          minOrder: f.min || '0',
          deliveryDays: f.days,
          notes: f.notes || null,
        })
      }
      onDone={(r) => {
        if (!editing) router.push(`/console/purchasing/suppliers/${r.id}`);
      }}
    >
      <Fieldset legend="Who" columns={2}>
        <TextField label="Name" value={f.name} onChange={set('name')} placeholder="Kariuki Wines and Spirits" required />
        <TextField label="Contact" value={f.contact} onChange={set('contact')} placeholder="Wanjiru" />
        <TextField label="Phone" type="tel" value={f.phone} onChange={set('phone')} placeholder="0722 000 000" />
        <TextField label="Email" type="email" value={f.email} onChange={set('email')} placeholder="orders@supplier.co.ke" />
      </Fieldset>
      <Fieldset legend="Terms" columns={3}>
        <TextField label="Pays in, days" value={f.terms} onChange={set('terms')} inputMode="numeric" />
        <TextField label="Delivers in, days" value={f.lead} onChange={set('lead')} inputMode="numeric" />
        <TextField label="Minimum order, KES" value={f.min} onChange={set('min')} inputMode="decimal" />
      </Fieldset>
      <DaysField label="Delivers on" value={f.days} onChange={(days) => setF((x) => ({ ...x, days }))} helper="Leave empty if they deliver any day." />
      <TextArea label="Notes" value={f.notes} onChange={set('notes')} rows={3} placeholder="Order by 14:00 for next-day delivery." />
    </FormDialog>
  );
}

/** Say a supplier carries an item: their code, the pack it comes in, and what one unit costs. */
export function SupplierItemDialog({ open, onClose, supplierId, target, items }: { open: boolean; onClose: () => void; supplierId: string; target: { variantId: string; name: string; supplierSku: string | null; packSize: number; costCents: Cents } | null; items: { value: string; label: string }[] }) {
  const [f, setF] = useState({ variantId: '', sku: '', pack: '1', cost: '' });
  useEffect(() => {
    if (open) setF({ variantId: target?.variantId ?? items[0]?.value ?? '', sku: target?.supplierSku ?? '', pack: String(target?.packSize ?? 1), cost: target ? formatDecimal(target.costCents) : '' });
  }, [open, target, items]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      width="md"
      title={target ? `${target.name} from this supplier` : 'Add an item they carry'}
      description="A changed cost joins the item's cost history, which the cost change alerts read."
      submitLabel={target ? 'Save' : 'Add item'}
      onSubmit={() => setSupplierItem({ supplierId, variantId: f.variantId, supplierSku: f.sku || null, packSize: Number(f.pack), cost: f.cost })}
    >
      {target ? null : <SelectField label="Item" value={f.variantId} onChange={(e) => setF((x) => ({ ...x, variantId: e.target.value }))} options={items} />}
      <Fieldset columns={3}>
        <TextField label="Their code" value={f.sku} onChange={(e) => setF((x) => ({ ...x, sku: e.target.value }))} placeholder="TK-500" />
        <TextField label="Pack of" value={f.pack} onChange={(e) => setF((x) => ({ ...x, pack: e.target.value }))} inputMode="numeric" />
        <TextField label="Cost a unit, KES" value={f.cost} onChange={(e) => setF((x) => ({ ...x, cost: e.target.value }))} inputMode="decimal" required />
      </Fieldset>
    </FormDialog>
  );
}
