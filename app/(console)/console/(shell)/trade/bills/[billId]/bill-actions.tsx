'use client';

import { type Cents, ZERO, add, formatKes } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { SelectField, Switch, TextField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Money } from '@bliss/ui/components/money';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowBackUp, IconBan } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { refundBill, voidBill } from '../../../_actions/trade';
import { ReasonDialog, useDialog } from '../../../_components/forms';

export interface RefundLine {
  id: string;
  description: string;
  totalCents: Cents;
  refunded: boolean;
}

type Method = 'cash' | 'mpesa' | 'card';

/**
 * Put a settled bill right. Void sets it aside and puts its lines back on the tab to be settled
 * again; refund gives the guest money back for chosen lines. Both need refund approval and a reason.
 */
export function BillActions({
  billId,
  billNumber,
  voidable,
  refundable,
  lines,
  drawers,
  paidWith,
}: {
  billId: string;
  billNumber: number;
  voidable: boolean;
  refundable: boolean;
  lines: RefundLine[];
  drawers: { value: string; label: string }[];
  /** How the guest paid, so the refund goes back the same way by default. */
  paidWith: Method;
}) {
  const dialog = useDialog<'void' | 'refund'>();
  const open = lines.filter((l) => !l.refunded);
  const [chosen, setChosen] = useState<string[]>([]);
  const [method, setMethod] = useState<Method>(paidWith);
  const [drawer, setDrawer] = useState(drawers[0]?.value ?? '');
  const [reference, setReference] = useState('');
  const [restock, setRestock] = useState(false);
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    if (!dialog.is('refund')) return;
    setChosen(open.map((l) => l.id));
    setMethod(paidWith);
    setDrawer(drawers[0]?.value ?? '');
    setReference('');
    setRestock(false);
    setRequestId(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time the dialog opens
  }, [dialog.is('refund')]);

  const amount = useMemo(() => open.filter((l) => chosen.includes(l.id)).reduce<Cents>((a, l) => add(a, l.totalCents), ZERO), [open, chosen]);

  if (!voidable && (!refundable || open.length === 0)) return null;
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <>
      {refundable && open.length > 0 ? (
        <Button variant="primary" icon={IconArrowBackUp} onClick={() => dialog.open('refund', null)}>
          Refund
        </Button>
      ) : null}
      {voidable ? <OverflowMenu label={`More for bill ${billNumber}`} items={[{ key: 'void', label: 'Void the bill', icon: IconBan, destructive: true, onSelect: () => dialog.open('void', null) }]} /> : null}

      <ReasonDialog
        open={dialog.is('void')}
        onClose={dialog.close}
        title={`Void bill ${billNumber}?`}
        description="For a bill settled wrongly. Its lines go back on the tab, open again, to be settled right. Stock does not move, and the cash leaves the drawer's expected figure."
        confirmLabel="Void the bill"
        quickReasons={['Settled on the wrong tab', 'Wrong tender recorded', 'Split wrongly']}
        run={(reason) => voidBill({ billId, reason })}
        toast={{ title: `Bill ${billNumber} voided`, body: 'Its lines are back on the tab.' }}
      />

      <ReasonDialog
        open={dialog.is('refund')}
        onClose={dialog.close}
        title={`Refund on bill ${billNumber}`}
        description="Choose the lines given back and how the money goes back. The bill stays, with the refund against it."
        confirmLabel={chosen.length > 0 ? `Refund ${formatKes(amount, { decimals: 'whole' })}` : 'Refund'}
        quickReasons={['Guest returned the drink', 'Charged for the wrong item', 'Drink was spoiled']}
        run={(reason) =>
          refundBill({
            billId,
            billLineIds: chosen,
            method,
            drawerSessionId: method === 'cash' ? drawer || null : null,
            reference: method === 'cash' ? null : reference,
            restock,
            reason,
            requestId,
          })
        }
        toast={{ title: `Bill ${billNumber} refunded`, body: `${formatKes(amount, { decimals: 'whole' })} given back.` }}
      >
        <div className="flex flex-col gap-16 pb-16">
          <fieldset className="flex flex-col">
            <legend className="mb-8 label-caps text-ink-subtle">Lines given back</legend>
            <ul className="flex flex-col rounded-control border border-rule">
              {lines.map((l) => (
                <li key={l.id} className="border-b border-rule last:border-b-0">
                  <label className={cx('flex min-h-row items-center gap-12 px-12 py-8', l.refunded ? 'text-ink-subtle' : 'cursor-pointer text-ink')}>
                    <input type="checkbox" checked={l.refunded || chosen.includes(l.id)} disabled={l.refunded} onChange={() => toggle(l.id)} className="size-16 accent-accent" />
                    <span className="min-w-0 flex-1 truncate text-ui">{l.description}</span>
                    {l.refunded ? <span className="text-body-sm">Refunded</span> : <Money value={l.totalCents} size="num-sm" tone={chosen.includes(l.id) ? 'default' : 'subtle'} />}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
            <SelectField
              label="Money goes back by"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'mpesa', label: 'M-Pesa reversal' },
                { value: 'card', label: 'Card reversal' },
              ]}
            />
            {method === 'cash' ? (
              drawers.length > 0 ? (
                <SelectField label="Paid from" value={drawer} onChange={(e) => setDrawer(e.target.value)} options={drawers} helper="A drawer open now. It shows as paid out on its count." />
              ) : (
                <p className="self-end text-body-sm text-stop">No drawer is open now. Open one on a counter, or give the money back another way.</p>
              )
            ) : (
              <TextField label={method === 'mpesa' ? 'M-Pesa reversal code' : 'Card reversal reference'} value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} placeholder={method === 'mpesa' ? 'SGR7XK2PQ1' : ''} required />
            )}
          </div>
          <Switch checked={restock} onChange={setRestock} label="Put the items back in stock" helper="Only when they can be sold again, such as a sealed bottle." />
        </div>
      </ReasonDialog>
    </>
  );
}
