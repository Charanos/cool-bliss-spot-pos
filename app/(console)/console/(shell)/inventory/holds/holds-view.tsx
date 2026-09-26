'use client';

import { formatAgo, formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { type Column, DataTable, StackCell } from '@bliss/ui/components/console/data-table';
import { Card } from '@bliss/ui/components/console/card';
import { Section } from '@bliss/ui/components/console/section';
import { SelectField } from '@bliss/ui/components/fields';
import { useNow } from '@bliss/ui/hooks';
import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { HoldDialog, ReleaseHoldDialog } from '../../_components/dialogs';

interface ActiveHold {
  id: string;
  variantId: string;
  product: string;
  variant: string;
  placedBy: string;
  placedAt: number;
  reason: string;
  expectedBack: string | null;
}

interface ReleasedHold {
  id: string;
  variant: string;
  reason: string;
  releaseNote: string | null;
  releasedBy: string;
  placedAt: number;
  releasedAt: number;
}

/** What the floor cannot sell, and why: holds placed and recently lifted. */
export function HoldsView({ active, released, holdable, timezone }: { active: ActiveHold[]; released: ReleasedHold[]; holdable: { value: string; label: string }[]; timezone: string }) {
  const now = useNow(60_000);
  const [pick, setPick] = useState('');
  const [hold, setHold] = useState<{ variantId: string; name: string } | null>(null);
  const [release, setRelease] = useState<{ holdId: string; name: string } | null>(null);

  const columns: Column<ActiveHold>[] = [
    { key: 'product', header: 'Product', width: 'minmax(180px,1.4fr)', fixed: true, sortValue: (r) => r.variant, csv: (r) => r.variant, cell: (r) => <StackCell primary={r.variant} secondary={r.product} /> },
    { key: 'by', header: 'Put on hold by', width: '140px', sortValue: (r) => r.placedBy, csv: (r) => r.placedBy, cell: (r) => <span className="text-ui text-ink">{r.placedBy}</span> },
    {
      key: 'when',
      header: 'When',
      width: '170px',
      sortValue: (r) => r.placedAt,
      csv: (r) => formatDateTime(r.placedAt, timezone),
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num-md">{formatDateTime(r.placedAt, timezone)}</span>} secondary={formatAgo(now - r.placedAt)} />,
    },
    { key: 'reason', header: 'Reason', width: 'minmax(260px,2.4fr)', wrap: true, csv: (r) => r.reason, cell: (r) => <span className="text-body-sm text-ink">{r.reason}</span> },
    { key: 'back', header: 'Expected back', width: '130px', sortValue: (r) => r.expectedBack, csv: (r) => r.expectedBack ?? '', cell: (r) => <span className="text-body-sm text-ink-muted">{r.expectedBack ? formatIsoDate(r.expectedBack) : 'Not given'}</span> },
    {
      key: 'action',
      header: '',
      width: '140px',
      align: 'right',
      fixed: true,
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setRelease({ holdId: r.id, name: r.variant })}>
          Take off hold
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-40">
      <Section
        id="holds-active"
        title="On hold now"
        description={active.length === 0 ? 'Nothing is on hold. Everything the ledger says you have, the floor can sell.' : `The floor cannot sell ${active.length === 1 ? 'this item' : `these ${active.length} items`} until ${active.length === 1 ? 'it is' : 'they are'} taken off hold.`}
        actions={
          <>
            <SelectField label="Item to hold" hideLabel value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: 'Choose an item to hold' }, ...holdable]} />
            <Button variant="secondary" size="sm" icon={IconLock} disabled={!pick} onClick={() => setHold({ variantId: pick, name: holdable.find((h) => h.value === pick)?.label ?? '' })}>
              Put on hold
            </Button>
          </>
        }
      >
        {active.length > 0 ? (
          <DataTable
            id="inventory-holds"
            caption="Items on hold"
            rows={active}
            columns={columns}
            rowKey={(r) => r.id}
            toolbar={false}
            urlState={false}
            defaultSort={{ key: 'when', dir: 'desc' }}
            empty={{ title: 'Nothing on hold', body: 'Everything the ledger says you have, the floor can sell.' }}
          />
        ) : null}
      </Section>

      {released.length > 0 ? (
        <Section id="holds-released" title="Recently taken off hold" description="The last ten, newest first.">
          <Card>
            <ul className="flex flex-col">
              {released.map((h) => (
                <li key={h.id} className="grid grid-cols-[minmax(160px,1fr)_2fr_minmax(180px,1fr)] items-baseline gap-16 border-b border-rule px-20 py-12 last:border-b-0">
                  <span className="text-ui text-ink">{h.variant}</span>
                  <span className="text-body-sm text-ink-muted">
                    {h.reason}
                    {h.releaseNote ? <span className="block text-ink-subtle">Taken off: {h.releaseNote}</span> : null}
                  </span>
                  <span className="text-right text-body-sm text-ink-subtle">
                    {h.releasedBy}, <span className="font-mono tabular">{formatDateTime(h.releasedAt, timezone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <HoldDialog
        target={hold}
        onClose={() => {
          setHold(null);
          setPick('');
        }}
      />
      <ReleaseHoldDialog target={release} onClose={() => setRelease(null)} />
    </div>
  );
}
