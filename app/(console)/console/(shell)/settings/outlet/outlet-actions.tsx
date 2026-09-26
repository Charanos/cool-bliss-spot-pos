'use client';

import { Button } from '@bliss/ui/components/button';
import { Switch, TextArea, TextField } from '@bliss/ui/components/fields';
import { IconPencil } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { updateOutlet } from '../../_actions/venue';
import { Fieldset, FormDialog, useDialog } from '../../_components/forms';

export interface OutletDraft {
  name: string;
  legalName: string;
  address: string;
  businessDayCutover: string;
  /** VAT as a percentage, such as 16. */
  taxRatePct: number;
  pricesTaxInclusive: boolean;
  lowStockDefault: number;
  /** In shillings, as typed. */
  drawerVarianceThreshold: string;
}

/**
 * Edit the outlet. Every change is audited with its reason; VAT and whether prices include it are
 * the owner's alone, since they change every price the floor charges.
 */
export function OutletActions({ outlet, isOwner }: { outlet: OutletDraft; isOwner: boolean }) {
  const dialog = useDialog<'edit'>();
  const [f, setF] = useState(outlet);
  const [taxPct, setTaxPct] = useState(String(outlet.taxRatePct));
  const [low, setLow] = useState(String(outlet.lowStockDefault));
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!dialog.is('edit')) return;
    setF(outlet);
    setTaxPct(String(outlet.taxRatePct));
    setLow(String(outlet.lowStockDefault));
    setReason('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [dialog.is('edit')]);
  const set = <K extends keyof OutletDraft>(key: K, value: OutletDraft[K]) => setF((x) => ({ ...x, [key]: value }));

  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit the outlet
      </Button>
      <FormDialog
        open={dialog.is('edit')}
        onClose={dialog.close}
        title="Edit the outlet"
        description="Stations pick up the change at their next sync. Every change is kept in the audit trail with your reason."
        submitLabel="Save changes"
        onSubmit={() => updateOutlet({ ...f, taxRatePct: Number(taxPct.replace(',', '.')), lowStockDefault: Number(low), reason })}
      >
        <Fieldset legend="The outlet">
          <TextField label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={60} />
          <TextField label="Registered as" value={f.legalName} onChange={(e) => set('legalName', e.target.value)} required maxLength={100} />
          <TextField label="Address" value={f.address} onChange={(e) => set('address', e.target.value)} required maxLength={200} className="desktop:col-span-2" />
        </Fieldset>
        <Fieldset legend="Tax">
          <TextField
            label="VAT, per cent"
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value)}
            inputMode="decimal"
            disabled={!isOwner}
            helper={isOwner ? 'Applied to every price from the next sale.' : 'Only an owner changes VAT.'}
          />
          <Switch checked={f.pricesTaxInclusive} onChange={(v) => set('pricesTaxInclusive', v)} disabled={!isOwner} label="Prices include VAT" helper="As printed on the menu and charged at the table." />
        </Fieldset>
        <Fieldset legend="The day and the lines">
          <TextField label="Business day ends" type="time" value={f.businessDayCutover} onChange={(e) => set('businessDayCutover', e.target.value)} required helper="A sale before this belongs to the night before." />
          <TextField label="Drawer allowed out by, KES" value={f.drawerVarianceThreshold} onChange={(e) => set('drawerVarianceThreshold', e.target.value)} inputMode="decimal" required helper="A count further out than this is flagged for review." />
          <TextField label="Low stock, unless set" value={low} onChange={(e) => setLow(e.target.value)} inputMode="numeric" required helper="Units, for any item without its own line." />
        </Fieldset>
        <TextArea label="Reason (at least 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required placeholder="Moved closing time for the new licence" />
      </FormDialog>
    </>
  );
}
