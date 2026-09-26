import { plural } from '@bliss/shared/format';
import { isZero } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Modifiers' };

/** Modifier groups: mixers, ice, garnish. A modifier linked to a variant depletes that variant's stock too. */
export default function ModifiersPage() {
  const groups = catalogue.modifierGroups().sort((a, b) => a.group.sortOrder - b.group.sortOrder);
  return (
    <>
      <ViewHeader page="/console/catalogue/modifiers" />
      <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
        {groups.map(({ group, modifiers, variantCount }) => (
          <Card key={group.id} as="article" className="h-full">
            <CardHeader
              band
              title={group.name}
              subtitle={`${group.isRequired ? 'Required' : 'Optional'}, choose ${group.minSelect === group.maxSelect ? group.maxSelect : `${group.minSelect} to ${group.maxSelect}`}`}
              meta={<span className="text-body-sm text-ink-subtle">{plural(variantCount, 'item')}</span>}
            />
            <ul className="flex flex-col">
              {modifiers
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-12 border-b border-rule px-20 py-8 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate text-ui text-ink">{m.name}</span>
                      {m.linkedVariantId ? <span className="block truncate text-body-sm text-ink-subtle">Takes stock of {catalogue.variantById(m.linkedVariantId)?.name ?? 'a removed item'}</span> : null}
                    </span>
                    {isZero(m.priceDeltaCents) ? <span className="text-body-sm text-ink-subtle">No charge</span> : <Money value={m.priceDeltaCents} currency={false} size="num-md" decimals="whole" tone="muted" />}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
