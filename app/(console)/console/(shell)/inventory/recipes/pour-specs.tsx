'use client';

import { formatQty } from '@bliss/shared/format';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { TextField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconPencil } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { savePourSpec } from '../../_actions/menu';
import { EntityLink } from '../../_components/entity-link';
import { Fieldset, FormDialog, useDialog } from '../../_components/forms';

export interface PourRow {
  variantId: string;
  productId: string;
  name: string;
  serveMl: number;
  depletionFactor: number;
  nominalMl: number | null;
  tolerancePct: number | null;
}

/** The measure each serve pours, how much of a bottle that is, and how far a count may drift. */
export function PourSpecsCard({ rows, canEdit }: { rows: PourRow[]; canEdit: boolean }) {
  const dialog = useDialog<'edit', PourRow | null>();
  const head = 'px-12 py-12 text-label text-ink-subtle';
  return (
    <>
      <Card aria-labelledby="pour-specs">
        <CardHeader band level="h2" titleId="pour-specs" title="Pour specs" subtitle="The measure each serve pours, and how far a count may drift from it before it is called out." />
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <caption className="sr-only">Pour specs</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`${head} pl-20 text-left`}>
                  Serve
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Measure
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Tolerance
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Of a bottle
                </th>
                <th scope="col" className={`${head} text-right`}>
                  From a bottle
                </th>
                <th scope="col" className={`${head} pr-20`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.variantId} className="border-b border-rule last:border-b-0">
                  <td className="py-12 pl-20 pr-12 text-ui">
                    <EntityLink kind="product" id={v.productId}>
                      {v.name}
                    </EntityLink>
                  </td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{v.nominalMl ?? v.serveMl}ml</td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{v.tolerancePct !== null ? `${v.tolerancePct}%` : 'Default'}</td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(v.depletionFactor, 4)}</td>
                  <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{v.depletionFactor > 0 ? Math.floor(1 / v.depletionFactor + 1e-9) : 'None'}</td>
                  <td className="py-8 pl-12 pr-20 text-right">{canEdit ? <OverflowMenu label={`More for ${v.name}`} items={[{ key: 'edit', label: 'Change the measure', icon: IconPencil, onSelect: () => dialog.open('edit', v) }]} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <PourDialog open={dialog.is('edit')} onClose={dialog.close} row={dialog.target} />
    </>
  );
}

function PourDialog({ open, onClose, row }: { open: boolean; onClose: () => void; row: PourRow | null }) {
  const [ml, setMl] = useState('');
  const [tol, setTol] = useState('');
  useEffect(() => {
    if (open && row) {
      setMl(String(row.nominalMl ?? row.serveMl));
      setTol(String(row.tolerancePct ?? 5));
    }
  }, [open, row]);
  return (
    <FormDialog open={open && Boolean(row)} onClose={onClose} width="md" title={`Pour spec for ${row?.name ?? ''}`} description="Pour variance compares what was sold at this measure with what the counts found." submitLabel="Save" onSubmit={() => savePourSpec({ variantId: row!.variantId, nominalVolumeMl: Number(ml), tolerancePct: Number(tol) })}>
      <Fieldset columns={2}>
        <TextField label="Measure, ml" value={ml} onChange={(e) => setMl(e.target.value)} inputMode="numeric" required />
        <TextField label="Tolerance, %" value={tol} onChange={(e) => setTol(e.target.value)} inputMode="decimal" helper="How far a count may drift before it is called out." />
      </Fieldset>
    </FormDialog>
  );
}
