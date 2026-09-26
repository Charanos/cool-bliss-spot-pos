'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { archiveRecipe } from '../../_actions/menu';
import { ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';
import { RecipeDialog, type RecipeDraft } from './recipe-dialog';

type Option = { value: string; label: string };

export function RecipesCreate({ canEdit, items, stockItems }: { canEdit: boolean; items: Option[]; stockItems: Option[] }) {
  const dialog = useDialog<'new'>();
  useCreateParam(() => dialog.open('new', null), canEdit);
  return <RecipeDialog open={dialog.is('new')} onClose={dialog.close} target={null} items={items} stockItems={stockItems} />;
}

export function RecipeActions({ recipe, items, stockItems, canEdit }: { recipe: RecipeDraft & { id: string }; items: Option[]; stockItems: Option[]; canEdit: boolean }) {
  const router = useRouter();
  const dialog = useDialog<'edit' | 'remove'>();
  if (!canEdit) return null;
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu label={`More for ${recipe.name}`} items={[{ key: 'remove', label: 'Remove the recipe', icon: IconTrash, destructive: true, onSelect: () => dialog.open('remove', null) }]} />
      <RecipeDialog open={dialog.is('edit')} onClose={dialog.close} target={recipe} items={items} stockItems={stockItems} />
      <ReasonDialog
        open={dialog.is('remove')}
        onClose={dialog.close}
        title={`Remove the recipe for ${recipe.name}?`}
        description="The item then pours from its own bottle only. Lines already fired keep what they took."
        confirmLabel="Remove recipe"
        quickReasons={['Drink taken off the menu', 'Recipe was wrong']}
        run={async (reason) => {
          const result = await archiveRecipe({ id: recipe.id, reason });
          if (result.ok) router.push('/console/inventory/recipes');
          return result;
        }}
      />
    </>
  );
}
