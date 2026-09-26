'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArchive, IconArrowBackUp, IconCopy, IconPencil } from '@tabler/icons-react';
import { setPriceListStatus } from '../../../_actions/menu';
import { ReasonDialog, useDialog } from '../../../_components/forms';
import { CopyPricesDialog, type ListDraft, PriceListDialog } from '../../_parts/list-dialogs';

export function ListActions({ list, active, lists, canEdit }: { list: ListDraft; active: boolean; lists: { value: string; label: string }[]; canEdit: boolean }) {
  const dialog = useDialog<'edit' | 'copy' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      {active && lists.length > 1 ? (
        <Button variant="ghost" icon={IconCopy} onClick={() => dialog.open('copy', null)}>
          Copy prices
        </Button>
      ) : null}
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${list.name}`}
        items={[
          active
            ? { key: 'archive', label: 'Archive', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Bring back', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <PriceListDialog open={dialog.is('edit')} onClose={dialog.close} target={list} />
      <CopyPricesDialog open={dialog.is('copy')} onClose={dialog.close} to={list} lists={lists} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={active ? `Archive ${list.name}?` : `Bring ${list.name} back?`}
        description={active ? 'The floor stops pricing from it at the next sync. Lines already fired keep their price.' : 'It prices again wherever a rule or zone uses it.'}
        confirmLabel={active ? 'Archive' : 'Bring back'}
        destructive={active}
        quickReasons={['Promotion ended', 'Replaced by another list']}
        run={(reason) => setPriceListStatus({ id: list.id, status: active ? 'archived' : 'active', reason })}
      />
    </>
  );
}
