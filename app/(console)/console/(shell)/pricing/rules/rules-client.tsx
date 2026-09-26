'use client';

import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArchive, IconArrowBackUp, IconPencil } from '@tabler/icons-react';
import { setRuleStatus } from '../../_actions/menu';
import { ReasonDialog, useCreateParam, useDialog } from '../../_components/forms';
import { RuleDialog, type RuleDraft } from '../_parts/rule-dialog';

type Others = (RuleDraft & { status: string })[];

/** The create dialog for time rules, opened by ?new=1. */
export function RulesCreate({ canEdit, overlays, others }: { canEdit: boolean; overlays: { value: string; label: string }[]; others: Others }) {
  const dialog = useDialog<'new'>();
  useCreateParam(() => dialog.open('new', null), canEdit);
  return <RuleDialog open={dialog.is('new')} onClose={dialog.close} target={null} overlays={overlays} others={others} />;
}

/** A rule's own actions: edit, switch off, switch on again. */
export function RuleActions({ rule, active, overlays, others, canEdit }: { rule: RuleDraft; active: boolean; overlays: { value: string; label: string }[]; others: Others; canEdit: boolean }) {
  const dialog = useDialog<'edit' | 'status'>();
  if (!canEdit) return null;
  return (
    <>
      <Button variant="outline" icon={IconPencil} onClick={() => dialog.open('edit', null)}>
        Edit
      </Button>
      <OverflowMenu
        label={`More for ${rule.name}`}
        items={[
          active
            ? { key: 'archive', label: 'Switch off', icon: IconArchive, destructive: true, onSelect: () => dialog.open('status', null) }
            : { key: 'restore', label: 'Switch on again', icon: IconArrowBackUp, onSelect: () => dialog.open('status', null) },
        ]}
      />
      <RuleDialog open={dialog.is('edit')} onClose={dialog.close} target={rule} overlays={overlays} others={others} />
      <ReasonDialog
        open={dialog.is('status')}
        onClose={dialog.close}
        title={active ? `Switch ${rule.name} off?` : `Switch ${rule.name} on again?`}
        description={active ? 'Its hours sell at the base price from the next sync.' : 'Its list prices its hours again from the next sync.'}
        confirmLabel={active ? 'Switch off' : 'Switch on'}
        destructive={active}
        quickReasons={['Promotion ended', 'Changing the hours']}
        run={(reason) => setRuleStatus({ id: rule.id, status: active ? 'archived' : 'active', reason })}
      />
    </>
  );
}
