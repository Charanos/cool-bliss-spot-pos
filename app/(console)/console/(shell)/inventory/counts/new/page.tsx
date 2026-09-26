import { Button } from '@bliss/ui/components/button';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { openCount } from '../../../_actions/inventory';

export const metadata: Metadata = { title: 'Start a blind count' };

/** Count setup, docs/10 N4 screen 1. */
export default function NewCountPage() {
  const locations = inventory.locations();
  const bar = locations.find((l) => l.kind === 'service');
  const people = identity.staffList().filter((s) => identity.can(s.id, 'stock.count.commit'));
  return (
    <div className="max-w-[640px]">
      <h2 className="text-title text-ink">Start a blind count</h2>
      <p className="mt-8 text-body text-ink-muted">
        A blind count compares what you have against what the ledger says you should have. The expected figures stay hidden until you commit.
      </p>
      <form action={openCount} className="mt-32 flex flex-col gap-24">
        <SelectField name="locationId" label="Location" defaultValue={bar?.id} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        <SelectField
          name="kind"
          label="Scope"
          defaultValue="full"
          options={[
            { value: 'full', label: 'Full, every product' },
            { value: 'cycle', label: 'Cycle, one category' },
            { value: 'spot', label: 'Spot, one category' },
          ]}
          helper="Cycle and spot counts use the category below."
        />
        <SelectField name="categoryId" label="Category" defaultValue="" options={[{ value: '', label: 'Every category' }, ...catalogue.categories().filter((c) => c.trackStock).map((c) => ({ value: c.id, label: c.name }))]} />
        <SelectField name="assignee" label="Counted by" defaultValue={people[0]?.id} options={people.map((p) => ({ value: p.id, label: p.displayName }))} />
        <TextField name="notes" label="Note (optional)" placeholder="Beer fridge, after the delivery" size="md" />
        <div className="flex items-center gap-16 pt-8">
          <Button type="submit" variant="primary" size="lg">
            Start blind count
          </Button>
          <Link href="/console/inventory/counts" className="text-body text-ink-muted hover:text-ink">
            Back to counts
          </Link>
        </div>
      </form>
    </div>
  );
}
