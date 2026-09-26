import { Button } from '@bliss/ui/components/button';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { DetailHeader } from '@bliss/ui/components/console/section';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import { openCount } from '../../../_actions/inventory';
import { RecordCrumb } from '../../../_components/shell/crumbs';

export const metadata: Metadata = { title: 'Start a stock count' };

/** Count setup, docs/10 N4 screen 1. A form that works before hydration; a refusal returns as ?error=. */
export default async function NewCountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const locations = inventory.locations();
  const bar = locations.find((l) => l.kind === 'service');
  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label="Start a count" />
      <DetailHeader
        back={{ href: '/console/inventory/counts', label: 'Counts' }}
        title="Start a stock count"
        meta={<p className="measure text-ui text-ink-muted">A blind count: whoever counts sees no expected figures until the count is sent for review, so what they write is what is there.</p>}
      />
      <Card className="max-w-form">
        <CardHeader band level="h2" title="What to count" />
        <CardBody className="pt-20">
          <form action={openCount} className="flex flex-col gap-20">
            {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
            <SelectField name="locationId" label="Where" defaultValue={bar?.id} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
            <div className="grid grid-cols-1 gap-20 desktop:grid-cols-2">
              <SelectField
                name="kind"
                label="How much"
                defaultValue="full"
                options={[
                  { value: 'full', label: 'Everything, a full count' },
                  { value: 'cycle', label: 'One category, a cycle count' },
                  { value: 'spot', label: 'One category, a spot check' },
                ]}
              />
              <SelectField
                name="categoryId"
                label="Category"
                defaultValue=""
                options={[{ value: '', label: 'Every category' }, ...catalogue.categories().filter((c) => c.trackStock).map((c) => ({ value: c.id, label: c.name }))]}
                helper="Used by a cycle count or a spot check."
              />
            </div>
            <TextField name="notes" label="Note" placeholder="Beer fridge, after the delivery" size="md" helper="Optional. Shown on the count." />
            <div className="flex items-center justify-end gap-12 border-t border-rule pt-16">
              <ButtonLink href="/console/inventory/counts" variant="ghost">
                Cancel
              </ButtonLink>
              <Button type="submit" variant="primary">
                Start the count
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
