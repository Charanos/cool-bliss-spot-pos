'use client';

import type { StockLocationKind } from '@bliss/shared/domain';
import { formatQty, plural } from '@bliss/shared/format';
import type { Cents } from '@bliss/shared/money';
import { Card, CardFooter, CardGroup, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Money } from '@bliss/ui/components/money';
import { StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconArchive, IconArrowBackUp, IconBuildingWarehouse, IconGlassFull, IconPencil, IconShoppingCart, IconTruckDelivery } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { saveLocation, setDefaultLocation, setLocationStatus } from '../../_actions/venue';
import { FormDialog, ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';

export interface LocationRow {
  id: string;
  name: string;
  kind: StockLocationKind;
  isDefaultReceipt: boolean;
  isDefaultSale: boolean;
  status: 'active' | 'archived';
  /** Items with stock here. */
  held: number;
  units: number;
  /** At cost, for those who may see it. */
  value: Cents | null;
}

const KIND: Record<StockLocationKind, { label: string; icon: typeof IconBuildingWarehouse }> = {
  store: { label: 'Store room', icon: IconBuildingWarehouse },
  service: { label: 'Behind the bar', icon: IconGlassFull },
  retail: { label: 'Bottle counter', icon: IconShoppingCart },
};

/** Every place stock is kept, as cards: what it holds, and whether deliveries or sales use it. */
export function LocationsView({ rows, canEdit }: { rows: LocationRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const dialog = useDialog<'edit' | 'status', LocationRow | null>();
  useCreateParam(() => dialog.open('edit', null), canEdit);
  const active = rows.filter((r) => r.status === 'active');
  const archived = rows.length - active.length;
  const receipt = rows.find((r) => r.isDefaultReceipt);
  const sale = rows.find((r) => r.isDefaultSale);
  const target = dialog.target;

  const makeDefault = (r: LocationRow, use: 'receipt' | 'sale') =>
    start(async () => {
      await setDefaultLocation({ id: r.id, use });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Locations" icon={IconBuildingWarehouse} value={<CountUp value={active.length} />} detail={archived > 0 ? `${archived} no longer used` : 'All in use'} />
        <Metric label="Deliveries land in" icon={IconTruckDelivery} value={<span className="font-sans text-title-lg">{receipt?.name ?? 'Not set'}</span>} detail="Unless a delivery says otherwise" />
        <Metric label="The floor sells from" icon={IconGlassFull} tone="poured" value={<span className="font-sans text-title-lg">{sale?.name ?? 'Not set'}</span>} detail="Every pour comes out of here" />
        <Metric label="Items held" icon={IconShoppingCart} value={<CountUp value={active.reduce((n, r) => n + r.held, 0)} delayMs={180} />} detail="Counting each place separately" />
      </MetricGrid>

      <CardGroup title="Where stock is kept" description="Each is counted on its own" icon={IconBuildingWarehouse} gridClassName="grid grid-cols-1 gap-16 desktop:grid-cols-3">
        {rows.map((r) => {
          const kind = KIND[r.kind];
          const items = canEdit
            ? r.status === 'active'
              ? [
                  { key: 'edit', label: 'Rename or change kind', icon: IconPencil, onSelect: () => dialog.open('edit', r) },
                  { key: 'receipt', label: 'Deliveries land here', icon: IconTruckDelivery, disabled: r.isDefaultReceipt, onSelect: () => makeDefault(r, 'receipt') },
                  { key: 'sale', label: 'The floor sells from here', icon: IconGlassFull, disabled: r.isDefaultSale, onSelect: () => makeDefault(r, 'sale') },
                  { key: 'archive', label: 'Stop using it', icon: IconArchive, destructive: true, disabled: r.isDefaultReceipt || r.isDefaultSale || r.held > 0, onSelect: () => dialog.open('status', r) },
                ]
              : [{ key: 'restore', label: 'Use it again', icon: IconArrowBackUp, onSelect: () => dialog.open('status', r) }]
            : [];
          return (
            <Card key={r.id} as="article" className="h-full" tone={r.isDefaultSale ? 'poured' : r.isDefaultReceipt ? 'accent' : undefined}>
              <CardHeader
                band
                icon={kind.icon}
                title={r.name}
                subtitle={kind.label}
                meta={r.status === 'archived' ? <StatusChip status="retired" label="Not used" /> : null}
                actions={items.length > 0 ? <OverflowMenu label={`More for ${r.name}`} size="sm" items={items} /> : undefined}
              />
              <CardStats columns={r.value === null ? 2 : 3}>
                <Stat label="Items">{r.held}</Stat>
                <Stat label="Units">{formatQty(r.units)}</Stat>
                {r.value === null ? null : (
                  <Stat label="At cost">
                    <Money value={r.value} currency={false} size="num-md" decimals="whole" />
                  </Stat>
                )}
              </CardStats>
              <CardFooter>
                <span className="flex flex-wrap gap-6">
                  {r.isDefaultReceipt ? <ToneChip tone="info">Deliveries land here</ToneChip> : null}
                  {r.isDefaultSale ? <ToneChip tone="poured">The floor sells from here</ToneChip> : null}
                  {!r.isDefaultReceipt && !r.isDefaultSale ? <span className="text-body-sm text-ink-subtle">{r.held > 0 ? plural(r.held, 'item') + ' kept here' : 'Empty'}</span> : null}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </CardGroup>

      <LocationDialog open={dialog.is('edit')} onClose={dialog.close} target={target} />
      <ReasonDialog
        open={dialog.is('status') && Boolean(target)}
        onClose={dialog.close}
        title={target?.status === 'active' ? `Stop using ${target?.name}?` : `Use ${target?.name} again?`}
        description={target?.status === 'active' ? 'It holds nothing, so nothing moves. Counts stop offering it.' : 'Counts offer it again.'}
        confirmLabel={target?.status === 'active' ? 'Stop using it' : 'Use it again'}
        destructive={target?.status === 'active'}
        quickReasons={target?.status === 'active' ? ['Store room closed', 'Merged with the bar'] : ['Back in use']}
        run={(reason) => setLocationStatus({ id: target!.id, status: target!.status === 'active' ? 'archived' : 'active', reason })}
      />
    </div>
  );
}

function LocationDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: LocationRow | null }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StockLocationKind>('store');
  useEffect(() => {
    if (!open) return;
    setName(target?.name ?? '');
    setKind(target?.kind ?? 'store');
  }, [open, target]);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      width="md"
      title={target ? `Edit ${target.name}` : 'Add a location'}
      description={target ? 'Its name and kind. What it holds does not change.' : 'A place stock is kept and counted. A count there sets what it holds.'}
      submitLabel={target ? 'Save changes' : 'Add the location'}
      onSubmit={() => saveLocation({ id: target?.id ?? null, name, kind })}
    >
      <TextField label="Called" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cold room" required maxLength={40} />
      <SelectField
        label="Kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as StockLocationKind)}
        options={(Object.keys(KIND) as StockLocationKind[]).map((k) => ({ value: k, label: KIND[k].label }))}
      />
    </FormDialog>
  );
}
