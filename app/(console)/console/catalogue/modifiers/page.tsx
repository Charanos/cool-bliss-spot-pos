import { plural } from '@bliss/shared/format';
import { isZero } from '@bliss/shared/money';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { Money } from '@bliss/ui/components/money';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import { TabIntro } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Modifiers' };

/** Modifier groups: mixers, ice, garnish. A modifier linked to a variant depletes that variant's stock too. */
export default function ModifiersPage() {
  const groups = catalogue.modifierGroups().sort((a, b) => a.group.sortOrder - b.group.sortOrder);
  return (
    <>
      <TabIntro>A modifier with a linked item, such as Coke as a mixer, takes that item&rsquo;s stock when the line is fired.</TabIntro>
      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2 desktop:grid-cols-3">
        {groups.map(({ group, modifiers, variantCount }) => (
          <RevealSection key={group.id} className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
            <div className="flex items-baseline justify-between gap-12">
              <h2 className="text-subtitle text-ink">{group.name}</h2>
              <span className="text-body-sm text-ink-subtle">{plural(variantCount, 'item')}</span>
            </div>
            <p className="mt-2 text-body-sm text-ink-muted">
              {group.isRequired ? 'Required' : 'Optional'} · choose {group.minSelect === group.maxSelect ? group.maxSelect : `${group.minSelect} to ${group.maxSelect}`}
            </p>
            <ul className="mt-12 border-t border-rule">
              {modifiers
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-12 border-b border-rule py-8 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate text-body text-ink">{m.name}</span>
                      {m.linkedVariantId ? <span className="block truncate text-body-sm text-ink-subtle">Takes stock of {catalogue.variantById(m.linkedVariantId)?.name}</span> : null}
                    </span>
                    {isZero(m.priceDeltaCents) ? <span className="text-body-sm text-ink-subtle">No charge</span> : <Money value={m.priceDeltaCents} currency={false} decimals="whole" tone="muted" />}
                  </li>
                ))}
            </ul>
          </RevealSection>
        ))}
      </div>
    </>
  );
}
