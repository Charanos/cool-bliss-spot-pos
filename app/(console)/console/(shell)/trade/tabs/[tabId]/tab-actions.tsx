'use client';

import { Button } from '@bliss/ui/components/button';
import { SelectField } from '@bliss/ui/components/fields';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArrowsExchange, IconBan, IconDoorExit, IconUserShare } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { forceCloseTab, handOverTabs, moveTab, voidTabLine } from '../../../_actions/trade';
import { FormDialog, ReasonDialog, useDialog } from '../../../_components/forms';

type Option = { value: string; label: string };

/**
 * A manager's hands on an open tab: move it when the guests move, give it to another waiter, or
 * close it when it cannot be closed at the counter. Each is the station's own command.
 */
export function TabActions({
  tabId,
  title,
  freeTables,
  waiters,
  assignedTo,
  unbilled,
}: {
  tabId: string;
  title: string;
  freeTables: Option[];
  waiters: Option[];
  assignedTo: string;
  /** Lines not yet on a bill: what closing it voids. */
  unbilled: number;
}) {
  const dialog = useDialog<'move' | 'hand' | 'close'>();
  const [table, setTable] = useState('');
  const [waiter, setWaiter] = useState('');
  const others = waiters.filter((w) => w.value !== assignedTo);

  useEffect(() => {
    if (dialog.is('move')) setTable(freeTables[0]?.value ?? '');
    if (dialog.is('hand')) setWaiter(others[0]?.value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset each time a dialog opens
  }, [dialog.is('move'), dialog.is('hand')]);

  return (
    <>
      <Button variant="secondary" icon={IconArrowsExchange} onClick={() => dialog.open('move', null)} disabled={freeTables.length === 0}>
        Move
      </Button>
      <OverflowMenu
        label={`More for ${title}`}
        items={[
          { key: 'hand', label: 'Hand over to another waiter', icon: IconUserShare, onSelect: () => dialog.open('hand', null), disabled: others.length === 0 },
          { key: 'close', label: 'Close the tab', icon: IconDoorExit, destructive: true, onSelect: () => dialog.open('close', null) },
        ]}
      />

      <FormDialog
        open={dialog.is('move')}
        onClose={dialog.close}
        width="md"
        title={`Move ${title}`}
        description="When the guests have moved. The tab keeps its lines, seats and bills; the old table is freed."
        submitLabel="Move the tab"
        onSubmit={() => moveTab({ tabId, toTableId: table })}
      >
        <SelectField label="To" value={table} onChange={(e) => setTable(e.target.value)} options={freeTables} helper="Tables in service with no tab on them." />
      </FormDialog>

      <FormDialog
        open={dialog.is('hand')}
        onClose={dialog.close}
        width="md"
        title={`Hand over ${title}`}
        description="The waiter it goes to sees it on their tablet at the next sync, and serves it from now."
        submitLabel="Hand over"
        onSubmit={() => handOverTabs({ tabIds: [tabId], toStaffId: waiter })}
      >
        <SelectField label="To" value={waiter} onChange={(e) => setWaiter(e.target.value)} options={others} />
      </FormDialog>

      <ReasonDialog
        open={dialog.is('close')}
        onClose={dialog.close}
        title={`Close ${title}?`}
        description={
          unbilled > 0
            ? `${unbilled === 1 ? 'The one line' : `The ${unbilled} lines`} not yet on a bill are voided with your reason. Poured stock stays gone; stock not poured goes back. The table is freed.`
            : 'Everything on it is on a bill. The tab closes and the table is freed.'
        }
        confirmLabel="Close the tab"
        quickReasons={['Left open from an earlier night', 'Guests left without paying', 'Opened by mistake']}
        run={(reason) => forceCloseTab({ tabId, reason })}
      />
    </>
  );
}

/** Void one line on an open tab, with the manager as the approver. */
export function LineVoid({ lineId, name }: { lineId: string; name: string }) {
  const dialog = useDialog<'void'>();
  return (
    <>
      <OverflowMenu label={`More for ${name}`} items={[{ key: 'void', label: 'Void the line', icon: IconBan, destructive: true, onSelect: () => dialog.open('void', null) }]} />
      <ReasonDialog
        open={dialog.is('void')}
        onClose={dialog.close}
        title={`Void ${name}?`}
        description="It comes off the tab. If it was poured, its stock stays gone and the void shows in the report."
        confirmLabel="Void the line"
        quickReasons={['Rang up by mistake', 'Guest changed their mind', 'Spilled before serving']}
        run={(reason) => voidTabLine({ lineId, reason })}
      />
    </>
  );
}
