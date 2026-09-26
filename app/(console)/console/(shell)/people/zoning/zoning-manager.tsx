'use client';

import type { ServiceTable, Zone } from '@bliss/shared/domain';
import { plural } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { type Column, DataTable, NumCell } from '@bliss/ui/components/console/data-table';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Section } from '@bliss/ui/components/console/section';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { StatusChip } from '@bliss/ui/components/status';
import { IconArmchair, IconLayoutGrid, IconMap2, IconPencil, IconPlus, IconTrash, IconUsers } from '@tabler/icons-react';
import { useState } from 'react';
import { removeServiceTable } from '../../_actions/venue';
import { EntityLink } from '../../_components/entity-link';
import { FormDialog, useCreateParam } from '../../_components/forms';
import { TableDialog } from './table-dialog';
import { ZoneDialog } from './zone-dialog';

const TABLE_STATE: Record<ServiceTable['status'], { status: 'active' | 'open' | 'suspended'; label: string }> = {
  available: { status: 'active', label: 'Available' },
  occupied: { status: 'open', label: 'Occupied' },
  out_of_service: { status: 'suspended', label: 'Out of service' },
};

function ZoneState({ zone }: { zone: Zone }) {
  return zone.status === 'active' ? <StatusChip status="active" /> : <StatusChip status="retired" label="Archived" />;
}

/**
 * Zones and the tables in them. Pane family: two flat sections, each a table with a card view.
 * Changes reach every tablet on its next sync.
 */
export function ZoningManager({ zones, tables, used, priceLists, canManage }: { zones: Zone[]; tables: ServiceTable[]; used: string[]; priceLists: { value: string; label: string }[]; canManage: boolean }) {
  const [editingZone, setEditingZone] = useState<Zone | 'new' | null>(null);
  const [editingTable, setEditingTable] = useState<ServiceTable | 'new' | null>(null);
  const [removing, setRemoving] = useState<ServiceTable | null>(null);
  useCreateParam(() => setEditingTable('new'), canManage && zones.length > 0);
  const usedIds = new Set(used);
  const seats = tables.filter((t) => t.status !== 'out_of_service').reduce((n, t) => n + t.seats, 0);
  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const outOfService = tables.filter((t) => t.status === 'out_of_service').length;
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? 'No zone';
  const inZone = (id: string) => tables.filter((t) => t.zoneId === id);
  const priceList = (id: string | null) => (id ? (priceLists.find((l) => l.value === id)?.label ?? 'Removed list') : 'The outlet default');

  const zoneColumns: Column<Zone>[] = [
    {
      key: 'name',
      header: 'Zone',
      width: 'minmax(200px,1.4fr)',
      fixed: true,
      sortValue: (z) => z.name,
      csv: (z) => z.name,
      cell: (z) => <span className="truncate text-ui font-medium text-ink">{z.name}</span>,
    },
    {
      key: 'tables',
      header: 'Tables',
      width: '96px',
      align: 'right',
      sortValue: (z) => inZone(z.id).length,
      csv: (z) => inZone(z.id).length,
      cell: (z) => <NumCell>{inZone(z.id).length}</NumCell>,
    },
    {
      key: 'seats',
      header: 'Seats',
      width: '96px',
      align: 'right',
      sortValue: (z) => inZone(z.id).reduce((n, t) => n + t.seats, 0),
      csv: (z) => inZone(z.id).reduce((n, t) => n + t.seats, 0),
      cell: (z) => <NumCell>{inZone(z.id).reduce((n, t) => n + t.seats, 0)}</NumCell>,
    },
    {
      key: 'list',
      header: 'Price list',
      width: 'minmax(160px,1fr)',
      csv: (z) => priceList(z.defaultPriceListId),
      cell: (z) =>
        z.defaultPriceListId ? (
          <EntityLink kind="priceList" id={z.defaultPriceListId} muted className="truncate text-ui">
            {priceList(z.defaultPriceListId)}
          </EntityLink>
        ) : (
          <span className="truncate text-ui text-ink-subtle">{priceList(null)}</span>
        ),
    },
    {
      key: 'order',
      header: 'Order on the floor',
      width: '144px',
      align: 'right',
      sortValue: (z) => z.sortOrder,
      csv: (z) => z.sortOrder,
      cell: (z) => <NumCell tone="muted">{z.sortOrder}</NumCell>,
    },
    {
      key: 'status',
      header: 'State',
      width: '112px',
      sortValue: (z) => z.status,
      csv: (z) => z.status,
      cell: (z) => <ZoneState zone={z} />,
    },
  ];

  const tableColumns: Column<ServiceTable>[] = [
    {
      key: 'label',
      header: 'Table',
      width: 'minmax(160px,1fr)',
      fixed: true,
      sortValue: (t) => t.label,
      csv: (t) => t.label,
      cell: (t) => <span className="truncate text-ui font-medium text-ink">{t.label}</span>,
    },
    {
      key: 'zone',
      header: 'Zone',
      width: 'minmax(160px,1fr)',
      sortValue: (t) => zoneName(t.zoneId),
      csv: (t) => zoneName(t.zoneId),
      cell: (t) => <span className="truncate text-ui text-ink-muted">{zoneName(t.zoneId)}</span>,
    },
    {
      key: 'seats',
      header: 'Seats',
      width: '96px',
      align: 'right',
      sortValue: (t) => t.seats,
      csv: (t) => t.seats,
      cell: (t) => <NumCell>{t.seats}</NumCell>,
    },
    {
      key: 'status',
      header: 'State',
      width: '136px',
      sortValue: (t) => t.status,
      csv: (t) => TABLE_STATE[t.status].label,
      cell: (t) => <StatusChip status={TABLE_STATE[t.status].status} label={TABLE_STATE[t.status].label} />,
    },
  ];

  const zoneActions = (z: Zone) =>
    canManage
      ? [
          {
            key: 'edit',
            label: 'Edit the zone',
            icon: IconPencil,
            onSelect: () => setEditingZone(z),
          },
        ]
      : [];
  const tableActions = (t: ServiceTable) =>
    canManage
      ? [
          {
            key: 'edit',
            label: 'Edit the table',
            icon: IconPencil,
            onSelect: () => setEditingTable(t),
          },
          ...(usedIds.has(t.id) ? [] : [{ key: 'remove', label: 'Remove the table', icon: IconTrash, destructive: true, onSelect: () => setRemoving(t) }]),
        ]
      : [];

  return (
    <div className="flex flex-col gap-40">
      <MetricGrid>
        <Metric label="Zones" icon={IconMap2} value={<CountUp value={zones.filter((z) => z.status === 'active').length} />} detail={zones.some((z) => z.defaultPriceListId) ? `${zones.filter((z) => z.defaultPriceListId).length} with their own prices` : 'All on the outlet prices'} />
        <Metric label="Tables" icon={IconLayoutGrid} value={<CountUp value={tables.length} delayMs={60} />} detail={outOfService > 0 ? `${outOfService} out of service` : 'All in service'} />
        <Metric label="Seats" icon={IconArmchair} tone="poured" value={<CountUp value={seats} delayMs={120} />} detail="At tables in service" />
        <Metric label="Occupied now" icon={IconUsers} tone={occupied > 0 ? 'info' : 'default'} value={<CountUp value={occupied} delayMs={180} />} detail={occupied > 0 ? 'A tab is open on them' : 'The floor is clear'} />
      </MetricGrid>

      <Section
        id="zones"
        title="Zones"
        description="The areas of the floor. A zone can carry its own price list, such as the terrace."
        actions={
          canManage ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={() => setEditingZone('new')}>
              Add a zone
            </Button>
          ) : null
        }
      >
        <DataTable
          id="zoning-zones"
          caption="Zones"
          noun={['zone', 'zones']}
          rows={zones}
          columns={zoneColumns}
          rowKey={(z) => z.id}
          defaultSort={{ key: 'order', dir: 'asc' }}
          rowTone={(z) => (z.status === 'active' ? 'default' : 'muted')}
          rowActions={canManage ? zoneActions : undefined}
          empty={{
            title: 'No zones yet',
            body: canManage ? 'Add a zone, then put tables in it.' : 'A manager sets up the zones.',
          }}
          renderGridCard={(z) => (
            <Card as="article" className="h-full">
              <CardHeader
                band
                title={z.name}
                subtitle={priceList(z.defaultPriceListId)}
                meta={<ZoneState zone={z} />}
                actions={canManage ? <OverflowMenu label={`Actions for ${z.name}`} size="sm" items={zoneActions(z)} /> : undefined}
              />
              <CardStats>
                <Stat label="Tables">{inZone(z.id).length}</Stat>
                <Stat label="Seats">{inZone(z.id).reduce((n, t) => n + t.seats, 0)}</Stat>
              </CardStats>
              <CardFooter>
                <span className="text-body-sm text-ink-muted">Prices</span>
                {z.defaultPriceListId ? (
                  <EntityLink kind="priceList" id={z.defaultPriceListId} className="truncate text-body-sm">
                    {priceList(z.defaultPriceListId)}
                  </EntityLink>
                ) : (
                  <span className="text-body-sm text-ink-subtle">{priceList(null)}</span>
                )}
              </CardFooter>
            </Card>
          )}
        />
      </Section>

      <Section
        id="tables"
        title="Tables"
        description={`${plural(tables.length, 'table')} across ${plural(zones.length, 'zone')}. A table with an open tab cannot be taken out of service.`}
        actions={
          canManage ? (
            <Button variant="create" size="sm" icon={IconPlus} onClick={() => setEditingTable('new')} disabled={zones.length === 0}>
              Add a table
            </Button>
          ) : null
        }
      >
        <DataTable
          id="zoning-tables"
          caption="Tables"
          noun={['table', 'tables']}
          rows={tables}
          columns={tableColumns}
          rowKey={(t) => t.id}
          defaultSort={{ key: 'label', dir: 'asc' }}
          search={{
            placeholder: 'Search tables',
            test: (t, q) => t.label.toLowerCase().includes(q),
          }}
          filters={[
            {
              kind: 'select',
              key: 'zone',
              label: 'Zone',
              options: zones.map((z) => ({ value: z.id, label: z.name })),
              test: (t, v) => t.zoneId === v,
            },
          ]}
          rowTone={(t) => (t.status === 'out_of_service' ? 'muted' : 'default')}
          rowActions={canManage ? tableActions : undefined}
          empty={{
            title: 'No tables yet',
            body: zones.length === 0 ? 'Add a zone first, then its tables.' : 'Add the tables in each zone, with how many seats each has.',
          }}
          emptyFiltered={{
            title: 'No tables match',
            body: 'Clear the zone or search to see every table.',
          }}
          renderGridCard={(t) => (
            <Card as="article" className="h-full">
              <CardHeader band title={t.label} subtitle={zoneName(t.zoneId)} actions={canManage ? <OverflowMenu label={`Actions for ${t.label}`} size="sm" items={tableActions(t)} /> : undefined} />
              <CardStats>
                <Stat label="Seats">{t.seats}</Stat>
              </CardStats>
              <CardFooter>
                <StatusChip status={TABLE_STATE[t.status].status} label={TABLE_STATE[t.status].label} />
              </CardFooter>
            </Card>
          )}
        />
      </Section>

      <ZoneDialog target={editingZone === 'new' ? null : editingZone} priceLists={priceLists} open={editingZone !== null} onClose={() => setEditingZone(null)} />
      <TableDialog target={editingTable === 'new' ? null : editingTable} zones={zones} open={editingTable !== null} onClose={() => setEditingTable(null)} />
      <FormDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        width="md"
        title={`Remove ${removing?.label ?? 'the table'}?`}
        description="It has never held a tab, so nothing refers to it. The tablets stop drawing it at their next sync."
        submitLabel="Remove the table"
        submitVariant="destructive"
        onSubmit={() => removeServiceTable({ tableId: removing!.id })}
      >
        <p className="text-body-sm text-ink-muted">To keep a table that has served guests but is not in use, take it out of service instead.</p>
      </FormDialog>
    </div>
  );
}
