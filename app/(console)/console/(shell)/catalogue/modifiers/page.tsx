import { ButtonLink } from '@bliss/ui/components/button-link';
import { IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import { ViewHeader } from '../../_components/workspace';
import { type ModifierGroupRow, ModifiersView } from './modifiers-view';

export const metadata: Metadata = { title: 'Modifiers' };

/** Modifier groups: mixers, ice, garnish. A modifier linked to an item depletes that item's stock too. */
export default async function ModifiersPage() {
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'price.write');
  const groups: ModifierGroupRow[] = catalogue
    .modifierGroups()
    .sort((a, b) => a.group.sortOrder - b.group.sortOrder)
    .map(({ group, modifiers, variantCount }) => ({
      id: group.id,
      name: group.name,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      status: group.status,
      items: variantCount,
      options: modifiers
        .filter((m) => m.status === 'active')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({ id: m.id, name: m.name, priceDeltaCents: m.priceDeltaCents, linkedVariantId: m.linkedVariantId, linkedName: m.linkedVariantId ? (catalogue.variantById(m.linkedVariantId)?.name ?? null) : null, linkedProductId: m.linkedVariantId ? (catalogue.productOfVariant(m.linkedVariantId)?.id ?? null) : null })),
    }));
  return (
    <>
      <ViewHeader
        page="/console/catalogue/modifiers"
        actions={
          canEdit ? (
            <ButtonLink href="/console/catalogue/modifiers?new=1" variant="create" icon={IconPlus}>
              Add a modifier group
            </ButtonLink>
          ) : null
        }
      />
      <ModifiersView groups={groups} stockItems={catalogue.stockVariants().map((v) => ({ value: v.id, label: v.name }))} canEdit={canEdit} />
    </>
  );
}
