'use client';

import { formatAgo, formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { type Column, DataTable, StackCell } from '@bliss/ui/components/console/data-table';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { EmptyState } from '@bliss/ui/components/feedback';
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

export function HoldsView({ active, released, holdable, timezone }: { active: ActiveHold[]; released: ReleasedHold[]; holdable: { value: string; label: string }[]; timezone: string }) {
  const now = useNow(60_000);
  const [pick, setPick] = useState('');
  const [hold, setHold] = useState<{ variantId: string; name: string } | null>(null);
  const [release, setRelease] = useState<{ holdId: string; name: string } | null>(null);

  const columns: Column<ActiveHold>[] = [
    { key: 'product', header: 'Product', width: 'minmax(180px,1.4fr)', fixed: true, sortValue: (r) => r.variant, csv: (r) => r.variant, cell: (r) => <StackCell primary={r.variant} secondary={r.product} /> },
    { key: 'by', header: 'Put on hold by', width: '140px', sortValue: (r) => r.placedBy, csv: (r) => r.placedBy, cell: (r) => <span className="text-body text-ink">{r.placedBy}</span> },
    {
      key: 'when',
      header: 'When',
      width: '170px',
      sortValue: (r) => r.placedAt,
      csv: (r) => formatDateTime(r.placedAt, timezone),
      cell: (r) => <StackCell primary={<span className="font-mono tabular text-num">{formatDateTime(r.placedAt, timezone)}</span>} secondary={formatAgo(now - r.placedAt)} />,
    },
    { key: 'reason', header: 'Reason', width: 'minmax(260px,2.4fr)', wrap: true, csv: (r) => r.reason, cell: (r) => <span className="text-body text-ink">{r.reason}</span> },
    { key: 'back', header: 'Expected back', width: '130px', sortValue: (r) => r.expectedBack, csv: (r) => r.expectedBack ?? '', cell: (r) => <span className="text-body text-ink-muted">{r.expectedBack ? formatIsoDate(r.expectedBack) : 'Not given'}</span> },
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
    <>
      <div className="mb-24 flex flex-wrap items-end justify-between gap-16">
        <p className="text-body text-ink-muted">
          {active.length === 0 ? 'Nothing is on hold.' : `${active.length} ${active.length === 1 ? 'item is' : 'items are'} on hold. The floor cannot sell ${active.length === 1 ? 'it' : 'them'}.`}
        </p>
        <div className="flex items-end gap-12">
          <div className="w-[260px]">
            <SelectField label="Put an item on hold" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: 'Choose a product' }, ...holdable]} />
          </div>
          <Button
            variant="secondary"
            icon={IconLock}
            disabled={!pick}
            onClick={() => setHold({ variantId: pick, name: holdable.find((h) => h.value === pick)?.label ?? '' })}
          >
            Put on hold
          </Button>
        </div>
      </div>

      {active.length === 0 ? (
        <EmptyState title="Nothing on hold" body="Everything the ledger says you have, the floor can sell." />
      ) : (
        <DataTable id="inventory-holds" caption="Items on hold" rows={active} columns={columns} rowKey={(r) => r.id} toolbar={false} urlState={false} defaultSort={{ key: 'when', dir: 'desc' }} empty={{ title: 'Nothing on hold', body: 'Everything the ledger says you have, the floor can sell.' }} />
      )}

      {released.length > 0 ? (
        <RevealSection className="mt-40">
          <h2 className="text-subtitle text-ink">Recently taken off hold</h2>
          <ul className="mt-12 border-t border-rule">
            {released.map((h) => (
              <li key={h.id} className="grid grid-cols-[minmax(160px,1fr)_2fr_minmax(180px,1fr)] gap-16 border-b border-rule py-12">
                <span className="text-body text-ink">{h.variant}</span>
                <span className="text-body text-ink-muted">
                  {h.reason}
                  {h.releaseNote ? <span className="block text-ink-subtle">Released: {h.releaseNote}</span> : null}
                </span>
                <span className="text-right text-body-sm text-ink-subtle">
                  {h.releasedBy} · <span className="font-mono tabular">{formatDateTime(h.releasedAt, timezone)}</span>
                </span>
              </li>
            ))}
          </ul>
        </RevealSection>
      ) : null}

      <HoldDialog
        target={hold}
        onClose={() => {
          setHold(null);
          setPick('');
        }}
      />
      <ReleaseHoldDialog target={release} onClose={() => setRelease(null)} />
    </>
  );
}
