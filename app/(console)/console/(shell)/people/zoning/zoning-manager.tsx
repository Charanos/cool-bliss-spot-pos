'use client';

import { useState } from 'react';
import type { Zone, ServiceTable } from '@bliss/shared/domain';
import { DataTable, type Column } from '@bliss/ui/components/console/data-table';
import { Button } from '@bliss/ui/components/button';
import { StatusChip } from '@bliss/ui/components/status';
import { IconPlus, IconEdit } from '@tabler/icons-react';
import { ZoneDialog } from './zone-dialog';
import { TableDialog } from './table-dialog';

export function ZoningManager({ zones, tables, canManage }: { zones: Zone[]; tables: ServiceTable[]; canManage: boolean }) {
  const [editingZone, setEditingZone] = useState<Zone | 'new' | null>(null);
  const [editingTable, setEditingTable] = useState<ServiceTable | 'new' | null>(null);

  const zoneColumns: Column<Zone>[] = [
    { key: 'name', header: 'Zone Name', width: 'minmax(200px, 1fr)', sortValue: (z) => z.name, cell: (z) => <span className="font-medium text-ink">{z.name}</span> },
    { key: 'sortOrder', header: 'Sort Order', width: '120px', align: 'right', sortValue: (z) => z.sortOrder, cell: (z) => <span className="font-mono tabular">{z.sortOrder}</span> },
    { key: 'status', header: 'Status', width: '120px', cell: (z) => <StatusChip status={z.status === 'active' ? 'active' : 'suspended'} label={z.status === 'active' ? 'Active' : 'Archived'} /> },
  ];

  const tableColumns: Column<ServiceTable>[] = [
    { key: 'label', header: 'Table Label', width: 'minmax(150px, 1fr)', sortValue: (t) => t.label, cell: (t) => <span className="font-medium text-ink">{t.label}</span> },
    { key: 'zone', header: 'Zone', width: '200px', sortValue: (t) => zones.find((z) => z.id === t.zoneId)?.name ?? '', cell: (t) => <span className="text-body text-ink-muted">{zones.find((z) => z.id === t.zoneId)?.name ?? 'Unknown'}</span> },
    { key: 'seats', header: 'Seats', width: '100px', align: 'right', sortValue: (t) => t.seats, cell: (t) => <span className="font-mono tabular">{t.seats}</span> },
    { key: 'status', header: 'Status', width: '120px', cell: (t) => <StatusChip status={t.status === 'available' ? 'active' : 'suspended'} label={t.status} /> },
  ];

  return (
    <div className="flex flex-col gap-32">
      <div className="flex flex-col gap-16">
        <div className="flex items-center justify-between">
          <h2 className="text-title-sm font-medium text-ink">Zones & Areas</h2>
        </div>
        <DataTable
          id="zoning-zones"
          caption="Zones"
          rows={zones}
          columns={zoneColumns}
          rowKey={(z) => z.id}
          leading={
            canManage ? (
              <button
                onClick={() => setEditingZone('new')}
                className="group relative inline-flex h-[32px] items-center gap-6 rounded-full bg-accent text-accent-ink px-16 text-[13px] font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_1px_3px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_3px_6px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] active:scale-[0.98] active:translate-y-0"
              >
                <IconPlus size={14} stroke={2.5} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
                <span>Add zone</span>
              </button>
            ) : undefined
          }
          rowActions={canManage ? (z) => [{ key: 'edit', label: 'Edit zone', icon: IconEdit, onSelect: () => setEditingZone(z) }] : undefined}
          renderGridCard={(z) => (
            <button onClick={() => canManage && setEditingZone(z)} className="text-left w-full h-full p-24 bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between group relative min-h-[160px]">
              <div className="flex justify-between items-start">
                <span className="text-title-md font-medium text-ink group-hover:text-accent transition-colors">{z.name}</span>
                <StatusChip status={z.status === 'active' ? 'active' : 'suspended'} />
              </div>
              <div className="flex flex-col mt-auto pt-16 border-t border-hairline/40">
                <span className="text-micro text-ink-subtle uppercase tracking-wider mb-4">Tables</span>
                <span className="text-body font-mono">{tables.filter(t => t.zoneId === z.id).length}</span>
              </div>
            </button>
          )}
          empty={{ title: 'No zones yet', body: 'Create a zone to start mapping your floorplan.' }}
        />
      </div>

      <div className="flex flex-col gap-16">
        <div className="flex items-center justify-between">
          <h2 className="text-title-sm font-medium text-ink">Service Tables</h2>
        </div>
        <DataTable
          id="zoning-tables"
          caption="Tables"
          rows={tables}
          columns={tableColumns}
          rowKey={(t) => t.id}
          search={{ placeholder: 'Search tables', test: (t, q) => t.label.toLowerCase().includes(q) }}
          filters={[
            { kind: 'select', key: 'zone', label: 'Zone', options: zones.map((z) => ({ value: z.id, label: z.name })), test: (t, v) => t.zoneId === v },
          ]}
          leading={
            canManage ? (
              <button
                onClick={() => setEditingTable('new')}
                className="group relative inline-flex h-[32px] items-center gap-6 rounded-full bg-accent text-accent-ink px-16 text-[13px] font-medium shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_1px_3px_color-mix(in_oklab,var(--color-accent)_30%,transparent)] transition-all hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_color-mix(in_oklab,white_20%,transparent),0_3px_6px_color-mix(in_oklab,var(--color-accent)_40%,transparent)] active:scale-[0.98] active:translate-y-0"
              >
                <IconPlus size={14} stroke={2.5} className="transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
                <span>Add table</span>
              </button>
            ) : undefined
          }
          rowActions={canManage ? (t) => [{ key: 'edit', label: 'Edit table', icon: IconEdit, onSelect: () => setEditingTable(t) }] : undefined}
          renderGridCard={(t) => {
            const zoneName = zones.find(z => z.id === t.zoneId)?.name ?? 'Unknown Zone';
            return (
              <button onClick={() => canManage && setEditingTable(t)} className="text-left w-full h-full p-24 bg-page rounded-[20px] border border-hairline/60 shadow-[0_4px_16px_rgba(0,0,0,0.02)] hover:border-hairline hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between group relative min-h-[160px]">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-4">
                    <span className="text-title-sm font-medium text-ink group-hover:text-accent transition-colors">{t.label}</span>
                    <span className="text-body-sm text-ink-subtle">{zoneName}</span>
                  </div>
                  <StatusChip status={t.status === 'available' ? 'active' : 'suspended'} label={t.status} />
                </div>
                <div className="flex items-center gap-16 mt-auto text-body-sm pt-12 border-t border-hairline/40">
                  <div className="flex flex-col">
                    <span className="text-micro text-ink-subtle uppercase tracking-wider mb-2">Seats</span>
                    <span className="font-mono">{t.seats}</span>
                  </div>
                </div>
              </button>
            );
          }}
          empty={{ title: 'No tables yet', body: 'Add tables to your zones to enable seating.' }}
        />
      </div>

      <ZoneDialog target={editingZone === 'new' ? null : editingZone} open={editingZone !== null} onClose={() => setEditingZone(null)} />
      <TableDialog target={editingTable === 'new' ? null : editingTable} zones={zones} open={editingTable !== null} onClose={() => setEditingTable(null)} />
    </div>
  );
}
