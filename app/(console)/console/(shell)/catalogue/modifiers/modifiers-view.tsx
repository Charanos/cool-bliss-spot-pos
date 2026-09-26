'use client';

import { isZero } from '@bliss/shared/money';
import { Card, CardFooter, CardHeader } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { IconAdjustmentsHorizontal, IconBottle, IconLink, IconPlus } from '@tabler/icons-react';
import { EntityLink } from '../../_components/entity-link';
import { useCreateParam, useDialog } from '../../_components/forms';
import { ModifierGroupDialog, type ModifierGroupDraft } from '../_parts/modifier-dialogs';

export interface ModifierGroupRow extends ModifierGroupDraft {
  status: 'active' | 'archived';
  items: number;
  options: (ModifierGroupDraft['options'][number] & { linkedName: string | null; linkedProductId: string | null })[];
}

/** Modifier groups as cards: each option, what it adds, and what stock it takes. */
export function ModifiersView({ groups, stockItems, canEdit }: { groups: ModifierGroupRow[]; stockItems: { value: string; label: string }[]; canEdit: boolean }) {
  const dialog = useDialog<'edit', ModifierGroupDraft | null>();
  useCreateParam(() => dialog.open('edit', null), canEdit);
  const active = groups.filter((g) => g.status === 'active');
  const options = active.flatMap((g) => g.options);
  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="Groups" icon={IconAdjustmentsHorizontal} value={<CountUp value={active.length} />} detail={groups.length > active.length ? `${groups.length - active.length} archived` : 'None archived'} />
        <Metric label="Options" icon={IconPlus} value={<CountUp value={options.length} delayMs={60} />} detail={`${options.filter((o) => !isZero(o.priceDeltaCents)).length} add to the price`} />
        <Metric label="Take stock" icon={IconBottle} value={<CountUp value={options.filter((o) => o.linkedVariantId).length} delayMs={120} />} detail="Options that deplete an item" />
        <Metric label="Items offering them" icon={IconLink} value={<CountUp value={active.reduce((n, g) => n + g.items, 0)} delayMs={180} />} detail="Links from items to groups" />
      </MetricGrid>

      {groups.length === 0 ? (
        <EmptyState title="No modifier groups yet" body="Add one for mixers, ice or garnish, then choose the items that offer it." />
      ) : (
        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.id} as="article" interactive className="group h-full">
              <CardHeader
                band
                title={g.name}
                href={`/console/catalogue/modifiers/${g.id}`}
                subtitle={`${g.minSelect > 0 ? 'Required' : 'Optional'}, choose ${g.minSelect === g.maxSelect ? g.maxSelect : `${g.minSelect} to ${g.maxSelect}`}`}
                meta={g.status === 'archived' ? <StatusChip status="retired" label="Archived" /> : null}
              />
              <ul className="flex flex-1 flex-col">
                {g.options.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-12 border-b border-rule px-20 py-8 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block truncate text-ui text-ink">{m.name}</span>
                      {m.linkedName ? (
                        <span className="block truncate text-body-sm text-ink-subtle">
                          Takes stock of{' '}
                          <EntityLink kind="product" id={m.linkedProductId} muted>
                            {m.linkedName}
                          </EntityLink>
                        </span>
                      ) : null}
                    </span>
                    {isZero(m.priceDeltaCents) ? <span className="text-body-sm text-ink-subtle">No charge</span> : <Money value={m.priceDeltaCents} currency={false} size="num-md" decimals="whole" tone="muted" />}
                  </li>
                ))}
              </ul>
              <CardFooter>
                <span className="text-body-sm text-ink-muted">Offered on {g.items === 1 ? 'one item' : `${g.items} items`}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <ModifierGroupDialog open={dialog.is('edit')} onClose={dialog.close} target={dialog.target} stockItems={stockItems} />
    </div>
  );
}
