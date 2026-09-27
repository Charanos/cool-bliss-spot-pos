'use client';

import { plural } from '@bliss/shared/format';
import { type Cents, formatKes, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Sheet, SheetCancel, SheetIcon, SheetPanel, SheetSection } from '@bliss/ui/components/floor/sheet';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { Photo } from '@bliss/ui/components/photo';
import { IconArrowRight, IconArrowsExchange, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { handOverTabs } from '@/lib/pos/actions';
import type { StaffDirectoryEntry } from '@/lib/pos/db';
import type { SeatedTab, TabListItem } from '@/lib/pos/queries';
import { useStaffPhotos } from '@/lib/pos/staff-photos';

const PICK = 'flex min-h-row-floor w-full items-center gap-12 rounded-card border px-12 py-8 text-left press-feedback transition-hover';
const PICK_ON = 'border-accent/50 bg-accent-wash';
const PICK_OFF = 'border-rule-raised/40 bg-control/60 hover:bg-control';
const ROLE_NAME: Record<string, string> = { waiter: 'Waiter', supervisor: 'Supervisor', manager: 'Manager', owner: 'Owner', cashier: 'Cashier' };

export interface ShiftHandoverSheetProps {
  open: boolean;
  onClose: () => void;
  myTabs: TabListItem[];
  /** Paid tables of mine whose guests are still sitting; clearing them moves with the handover. */
  mySeated: SeatedTab[];
  colleagues: StaffDirectoryEntry[];
  allTabs: TabListItem[];
}

interface Row {
  id: string;
  label: string;
  total: Cents;
  seated: boolean;
}

/**
 * Hand tables to a colleague. docs/16 section 8.
 *
 * Every table the waiter looks after is listed, chosen by default: the ones being ordered on and
 * the paid ones whose guests are still sitting. The colleagues show what they already carry, so a
 * section goes to someone who can take it. Undo, on the notice that follows, hands every table back.
 */
export function ShiftHandoverSheet({ open, onClose, myTabs, mySeated, colleagues, allTabs }: ShiftHandoverSheetProps) {
  const photoOf = useStaffPhotos();
  const rows: Row[] = [
    ...myTabs.map((t) => ({ id: t.tab.id, label: t.label, total: t.total, seated: false })),
    ...mySeated.map((t) => ({ id: t.tab.id, label: t.label, total: t.paid, seated: true })),
  ];
  const [targetId, setTargetId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Each time it opens: every table chosen, nobody picked yet.
  useEffect(() => {
    if (!open) return;
    setChosen(rows.map((r) => r.id));
    setTargetId(null);
    // Only on opening; the rows themselves update live underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = rows.filter((r) => chosen.includes(r.id));
  const target = colleagues.find((c) => c.id === targetId) ?? null;
  const allChosen = selected.length === rows.length && rows.length > 0;

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const commit = async () => {
    if (!target || selected.length === 0 || busy) return;
    setBusy(true);
    const ok = await handOverTabs(
      selected.map((r) => r.id),
      { id: target.id, name: target.displayName },
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="lg"
      eyebrow="End of shift"
      title="Hand over tables"
      leading={<SheetIcon icon={IconArrowsExchange} />}
      description="Choose the tables and who takes them. Seats, rounds and bills go with them, unchanged."
      footer={
        <div className="flex w-full items-center justify-between gap-12">
          <span className="hidden min-w-0 truncate text-body-sm text-ink-muted pad:block">
            {selected.length === 0 ? 'No tables chosen' : `${plural(selected.length, 'table')} · ${formatKes(sum(selected.map((r) => r.total)), { decimals: 'whole' })}`}
          </span>
          <div className="flex flex-1 items-center justify-end gap-8">
            <SheetCancel onClick={onClose} />
            <Button variant="primary" size="lg" shape="pill" icon={IconArrowRight} iconPosition="end" loading={busy} disabled={!target || selected.length === 0} onClick={() => void commit()}>
              {!target ? 'Choose who takes them' : selected.length === 0 ? 'Choose a table' : `Hand ${plural(selected.length, 'table')} to ${target.displayName.split(' ')[0]}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-32">
        <SheetSection
          label={`Tables · ${selected.length} of ${rows.length}`}
          aside={
            rows.length > 1 ? (
              <button type="button" onClick={() => setChosen(allChosen ? [] : rows.map((r) => r.id))} className="rounded-pill px-8 py-2 text-label font-medium text-accent-text press-feedback hover:bg-accent-wash">
                {allChosen ? 'Choose none' : 'Choose all'}
              </button>
            ) : null
          }
        >
          {rows.length === 0 ? (
            <SheetPanel className="py-16">
              <p className="text-body text-ink-muted">You have no tables to hand over.</p>
            </SheetPanel>
          ) : (
            <ul className="grid grid-cols-1 gap-8 pad:grid-cols-2">
              {rows.map((r) => {
                const on = chosen.includes(r.id);
                return (
                  <li key={r.id}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(r.id)} className={cx(PICK, on ? PICK_ON : PICK_OFF)}>
                      <span aria-hidden="true" className={cx('flex size-20 shrink-0 items-center justify-center rounded-sm border', on ? 'border-accent bg-accent text-accent-ink' : 'border-rule-raised text-transparent')}>
                        <IconCheck size={14} stroke={ICON_STROKE} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">{r.label}</span>
                        {r.seated ? <span className="block text-label text-poured">Paid, still seated</span> : null}
                      </span>
                      <span className="shrink-0 font-mono tabular text-num-sm text-ink-muted">{formatKes(r.total, { decimals: 'whole' })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetSection>

        <SheetSection label="To">
          {colleagues.length === 0 ? (
            <SheetPanel className="py-16">
              <p className="text-body text-ink-muted">Nobody else works the floor right now.</p>
            </SheetPanel>
          ) : (
            <ul role="radiogroup" aria-label="Who takes them" className="grid grid-cols-1 gap-8 pad:grid-cols-2">
              {colleagues.map((c) => {
                const theirs = allTabs.filter((t) => t.tab.assignedTo === c.id);
                const on = targetId === c.id;
                const photo = photoOf(c.id);
                return (
                  <li key={c.id}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setTargetId(c.id)} className={cx(PICK, 'min-h-control-xl', on ? PICK_ON : PICK_OFF)}>
                      <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center overflow-hidden rounded-dot bg-accent-wash text-label font-medium text-accent-text">
                        {photo ? <Photo src={photo} className="h-full w-full object-cover" /> : c.displayName.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-ink">
                          {c.displayName}
                          <span className="font-regular text-ink-subtle"> · {ROLE_NAME[c.roleKey] ?? c.roleKey}</span>
                        </span>
                        <span className="flex items-center gap-6 text-label text-ink-muted">
                          {theirs.length === 0 ? (
                            <>
                              <Dot tone="poured" />
                              No tables yet
                            </>
                          ) : (
                            `${plural(theirs.length, 'table')} · ${formatKes(sum(theirs.map((t) => t.total)), { decimals: 'whole' })}`
                          )}
                        </span>
                      </span>
                      <span aria-hidden="true" className={cx('flex size-20 shrink-0 items-center justify-center rounded-dot border', on ? 'border-accent bg-accent text-accent-ink' : 'border-rule-raised text-transparent')}>
                        <IconCheck size={14} stroke={ICON_STROKE} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SheetSection>
      </div>
    </Sheet>
  );
}
