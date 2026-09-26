'use client';

import { cents } from '@bliss/shared/money';
import { Button, IconButton } from '@bliss/ui/components/button';
import { type Column, DataTable, NumCell, StackCell } from '@bliss/ui/components/console/data-table';
import { Section } from '@bliss/ui/components/console/section';
import { FilterChips, Segmented } from '@bliss/ui/components/choice';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { Money } from '@bliss/ui/components/money';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

interface Row {
  id: string;
  name: string;
  zone: string;
  guests: number;
  total: bigint;
}

const ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Table ${i + 1}`, zone: i % 2 ? 'Terrace' : 'Main bar', guests: (i % 5) + 1, total: BigInt((i + 1) * 43_000) }));

/** The interactive primitives: buttons, choices, the menu and the data table with its states. */
export function KitInteractive() {
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('day');
  const [chips, setChips] = useState<'all' | 'open' | 'settled'>('all');
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Table', width: 'minmax(160px,1fr)', fixed: true, sortValue: (r) => r.name, csv: (r) => r.name, cell: (r) => <StackCell primary={r.name} secondary={r.zone} /> },
    { key: 'guests', header: 'Guests', width: '96px', align: 'right', sortValue: (r) => r.guests, csv: (r) => r.guests, cell: (r) => <NumCell>{r.guests}</NumCell> },
    { key: 'total', header: 'Total', width: '128px', align: 'right', sortValue: (r) => r.total, csv: (r) => String(r.total), cell: (r) => <Money value={cents(r.total)} size="num-md" /> },
  ];
  return (
    <>
      <Section id="kit-buttons" title="Buttons" description="One button look. An icon-only button always carries a label.">
        <div className="flex flex-wrap items-center gap-8">
          <Button variant="primary" icon={IconPlus}>
            Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="quiet-destructive" icon={IconTrash}>
            Quiet destructive
          </Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <IconButton icon={IconPencil} label="Edit" variant="ghost" />
          <OverflowMenu label="More actions" items={[{ key: 'a', label: 'Edit', icon: IconPencil, onSelect: () => undefined }, { key: 'b', label: 'Remove', icon: IconDots, destructive: true, onSelect: () => undefined }]} />
        </div>
        <div className="flex flex-wrap items-center gap-8">
          {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
            <Button key={size} size={size} variant="secondary">
              Size {size}
            </Button>
          ))}
        </div>
      </Section>

      <Section id="kit-choice" title="Choices" description="Radio groups with arrow keys.">
        <Segmented
          label="Range"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <FilterChips
          label="State"
          value={chips}
          onChange={setChips}
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'settled', label: 'Settled' },
          ]}
        />
      </Section>

      <Section id="kit-table" title="Data table" description="Search, a filter, sort, export, a grid view, and its empty and filtered states.">
        <DataTable
          id="kit-table"
          caption="Example tables"
          noun={['table', 'tables']}
          rows={ROWS}
          columns={columns}
          rowKey={(r) => r.id}
          urlState={false}
          search={{ placeholder: 'Search tables', test: (r, q) => r.name.toLowerCase().includes(q) }}
          filters={[{ kind: 'select', key: 'zone', label: 'Zone', options: [{ value: 'Main bar', label: 'Main bar' }, { value: 'Terrace', label: 'Terrace' }], test: (r, v) => r.zone === v }]}
          rowActions={() => [{ key: 'edit', label: 'Edit', icon: IconPencil, onSelect: () => undefined }]}
          exportName="kit"
          empty={{ title: 'No tables', body: 'Tables appear here once they exist.' }}
          emptyFiltered={{ title: 'No tables match', body: 'Clear the zone or the search.' }}
        />
        <DataTable id="kit-empty" caption="An empty table" rows={[]} columns={columns} rowKey={(r) => r.id} urlState={false} toolbar={false} empty={{ title: 'Nothing here yet', body: 'An empty table says what will appear, and how.' }} />
      </Section>
    </>
  );
}
