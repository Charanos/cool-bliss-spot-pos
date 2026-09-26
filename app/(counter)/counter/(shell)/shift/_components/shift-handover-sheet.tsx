'use client';

import { plural } from '@bliss/shared/format';
import { type Cents, formatKes, sum } from '@bliss/shared/money';
import { Button } from '@bliss/ui/components/button';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { handOverTabs } from '@/lib/pos/actions';
import type { StaffDirectoryEntry } from '@/lib/pos/db';
import type { SeatedTab, TabListItem } from '@/lib/pos/queries';
import { staffPhoto } from '@/lib/pos/staff-photos';

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
      description="Choose the tables and who takes them. Seats, rounds and bills go with them, unchanged."
      footer={
        <div className="flex w-full items-center justify-between gap-12">
          <span className="hidden min-w-0 truncate text-body-sm text-ink-muted pad:block">
            {selected.length === 0 ? 'No tables chosen' : `${plural(selected.length, 'table')} · ${formatKes(sum(selected.map((r) => r.total)), { decimals: 'whole' })}`}
          </span>
          <div className="flex flex-1 items-center justify-end gap-8">
            <Button variant="ghost" size="lg" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" size="lg" icon={IconArrowRight} iconPosition="end" loading={busy} disabled={!target || selected.length === 0} onClick={() => void commit()}>
              {!target ? 'Choose who takes them' : selected.length === 0 ? 'Choose a table' : `Hand ${plural(selected.length, 'table')} to ${target.displayName.split(' ')[0]}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-24">
        <section aria-labelledby="handover-tables" className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h3 id="handover-tables" className="caps text-ink-subtle">
              Tables · {selected.length} of {rows.length}
            </h3>
            {rows.length > 1 ? (
              <button type="button" onClick={() => setChosen(allChosen ? [] : rows.map((r) => r.id))} className="h-control-sm rounded-[10px] px-12 text-label font-medium text-accent-text press-feedback hover:bg-accent/10">
                {allChosen ? 'Choose none' : 'Choose all'}
              </button>
            ) : null}
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg bg-control px-16 py-16 text-body text-ink-muted">You have no tables to hand over.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 pad:grid-cols-2">
              {rows.map((r) => {
                const on = chosen.includes(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(r.id)}
                      className={cx(
                        'flex min-h-row-floor w-full items-center gap-12 rounded-[16px] px-12 text-left press-feedback',
                        on ? 'bg-accent/[0.1] ring-1 ring-inset ring-accent/35' : 'bg-control hover:bg-control-hover',
                      )}
                    >
                      <span aria-hidden="true" className={cx('flex size-[22px] shrink-0 items-center justify-center rounded-[7px]', on ? 'bg-accent text-accent-ink' : 'bg-control-hover text-transparent')}>
                        <IconCheck size={14} stroke={ICON_STROKE} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{r.label}</span>
                        {r.seated ? <span className="block text-label text-poured">Paid · still seated</span> : null}
                      </span>
                      <span className="shrink-0 font-mono tabular text-num-sm text-ink-muted">{formatKes(r.total, { decimals: 'whole' })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="handover-to" className="flex flex-col gap-8">
          <h3 id="handover-to" className="caps text-ink-subtle">
            To
          </h3>
          {colleagues.length === 0 ? (
            <p className="rounded-lg bg-control px-16 py-16 text-body text-ink-muted">Nobody else works the floor right now.</p>
          ) : (
            <ul role="radiogroup" aria-labelledby="handover-to" className="grid grid-cols-1 gap-6 pad:grid-cols-2">
              {colleagues.map((c) => {
                const theirs = allTabs.filter((t) => t.tab.assignedTo === c.id);
                const on = targetId === c.id;
                const photo = staffPhoto(c.displayName);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTargetId(c.id)}
                      className={cx(
                        'flex min-h-[64px] w-full items-center gap-12 rounded-[16px] px-12 text-left press-feedback',
                        on ? 'bg-accent/[0.1] ring-1 ring-inset ring-accent/35' : 'bg-control hover:bg-control-hover',
                      )}
                    >
                      <span aria-hidden="true" className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-dot bg-accent-wash text-label font-medium text-accent-text">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          c.displayName.slice(0, 1)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">
                          {c.displayName}
                          <span className="text-body-sm text-ink-subtle"> · {c.roleKey === 'supervisor' ? 'Supervisor' : 'Waiter'}</span>
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
                      <span aria-hidden="true" className={cx('flex size-[22px] shrink-0 items-center justify-center rounded-dot', on ? 'bg-accent text-accent-ink' : 'bg-control-hover text-transparent')}>
                        <IconCheck size={14} stroke={ICON_STROKE} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
