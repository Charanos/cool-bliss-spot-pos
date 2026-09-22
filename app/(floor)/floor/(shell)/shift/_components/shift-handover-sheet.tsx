'use client';

import { plural } from '@bliss/shared/format';
import { formatKes, sum } from '@bliss/shared/money';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { OverlayActions } from '@bliss/ui/components/overlay';
import { Dot } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { staffPhoto } from '@/lib/pos/staff-photos';
import {
  IconArrowRight,
  IconCheck,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { StaffDirectoryEntry } from '@/lib/pos/db';
import { handOver } from '@/lib/pos/mutations';
import type { TabListItem } from '@/lib/pos/queries';

export interface ShiftHandoverSheetProps {
  open: boolean;
  onClose: () => void;
  myTabs: TabListItem[];
  colleagues: StaffDirectoryEntry[];
  allTabs: TabListItem[];
  onSuccess: (message: string) => void;
}

/**
 * Production-grade Shift Handover Console for Floor Waiters.
 * Shows live colleague workload telemetry to prevent overloaded section handovers.
 * Conforms strictly to bliss/one-pane and bliss/max-font-weight.
 */
export function ShiftHandoverSheet({
  open,
  onClose,
  myTabs,
  colleagues,
  allTabs,
  onSuccess,
}: ShiftHandoverSheetProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    myTabs.map((t) => t.tab.id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize selection if tab list changes
  const activeSelectedIds = selectedIds.filter((id) =>
    myTabs.some((t) => t.tab.id === id),
  );
  const selectedTabs = myTabs.filter((t) => activeSelectedIds.includes(t.tab.id));
  const selectedTotal = sum(selectedTabs.map((t) => t.total));

  const target = colleagues.find((c) => c.id === targetId);

  const toggleTab = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedIds(myTabs.map((t) => t.tab.id));
  const deselectAll = () => setSelectedIds([]);

  const handleCommit = async () => {
    if (!target || activeSelectedIds.length === 0) return;
    try {
      setSubmitting(true);
      setError(null);
      await handOver(activeSelectedIds, target.id);
      onClose();
      onSuccess(
        `${plural(activeSelectedIds.length, 'tab')} (${formatKes(selectedTotal, { decimals: 'whole' })}) handed over to ${target.displayName}. Seats, labels and lines are unchanged.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handover could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="lg"
      className="desktop:!w-[760px] desktop:max-w-[760px]"
      title={
        <div className="flex flex-col gap-6 w-full pr-8">
          <div className="flex items-center justify-between gap-12 flex-wrap">
            <div className="flex items-center gap-8 min-w-0">
              <span className="text-title-lg font-medium text-ink ">
                Shift Handover
              </span>
              <Badge tone="accent" className="!rounded-dot px-12 py-6 font-mono text-micro">
                {activeSelectedIds.length} of {myTabs.length} tabs selected
              </Badge>
            </div>
            <span className="font-mono text-body-sm text-ink-subtle">
              Total: {formatKes(selectedTotal, { decimals: 'whole' })}
            </span>
          </div>
          <p className="font-mono text-micro text-ink-subtle">
            Select colleague taking over your section. All seats, fired orders, and lines remain intact.
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-20 pb-12">
        {/* ── 1. Reassurance Explanatory Banner ───────────────────────── */}
        <div className="flex items-start gap-12 p-16 rounded-[16px] bg-control border-t border-b border-rule-raised/20 text-ink-subtle">
          <IconInfoCircle size={18} className="shrink-0 text-accent mt-2" />
          <p className="font-mono text-micro text-ink-subtle ">
            Handing over moves tab responsibility to the colleague waiter. Table numbers, guest seat assignments,
            and unsettled orders transfer automatically.
          </p>
        </div>

        {/* ── 2. Tab Selection Checklist (Granular vs Batch) ─────────── */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-micro uppercase text-ink-subtle">
              Tables to transfer ({activeSelectedIds.length})
            </span>
            <div className="flex items-center gap-8 font-mono text-micro">
              <button
                type="button"
                onClick={selectAll}
                className="text-accent hover:underline cursor-pointer"
              >
                Select all
              </button>
              <span className="text-ink-disabled">·</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-ink-subtle hover:text-ink cursor-pointer"
              >
                Deselect
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-8 max-h-[160px] overflow-y-auto no-scrollbar">
            {myTabs.map((t) => {
              const isChecked = activeSelectedIds.includes(t.tab.id);
              return (
                <button
                  key={t.tab.id}
                  type="button"
                  onClick={() => toggleTab(t.tab.id)}
                  className={cx(
                    'flex items-center justify-between p-12 rounded-[14px] text-left transition-all cursor-pointer border-t border-b border-rule-raised/20',
                    isChecked
                      ? 'bg-accent-wash text-ink'
                      : 'hover:bg-control-hover text-ink-subtle',
                  )}
                >
                  <div className="flex items-center gap-8 min-w-0">
                    <div
                      className={cx(
                        'size-20 rounded flex items-center justify-center shrink-0 border transition-all',
                        isChecked
                          ? 'bg-accent border-accent text-accent-ink'
                          : 'border-rule-raised/60 text-transparent',
                      )}
                    >
                      <IconCheck size={13} stroke={2.5} />
                    </div>
                    <span className="text-body-sm font-medium text-ink truncate">
                      {t.label}
                    </span>
                  </div>
                  <span className="font-mono text-micro font-medium text-ink-muted">
                    {formatKes(t.total, { decimals: 'whole' })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. Colleague Workload Directory Grid ────────────────────── */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-micro uppercase text-ink-subtle">
              Receiving colleague (select one)
            </span>
            <span className="font-mono text-micro text-ink-disabled">
              {colleagues.length} available on floor
            </span>
          </div>

          <div
            className="grid grid-cols-1 tablet:grid-cols-2 gap-8"
            role="radiogroup"
            aria-label="Colleague selection"
          >
            {colleagues.map((c) => {
              const colleagueTabs = allTabs.filter(
                (t) => t.tab.assignedTo === c.id,
              );
              const colleagueTotal = sum(colleagueTabs.map((t) => t.total));
              const isSelected = targetId === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setTargetId(c.id)}
                  className={cx(
                    'flex items-center justify-between p-16 rounded-[16px] transition-all text-left cursor-pointer border-t border-b border-rule-raised/25',
                    isSelected
                      ? 'bg-accent-wash ring-1 ring-accent/40 shadow-raised'
                      : 'hover:bg-control-hover',
                  )}
                >
                  <div className="flex items-center gap-12 min-w-0">
                    {/* Colleague Avatar Photo */}
                    <div
                      aria-hidden="true"
                      className="flex size-[36px] items-center justify-center overflow-hidden rounded-dot border border-hairline/60 bg-accent-wash text-label font-medium text-accent-text select-none shadow-raised shrink-0"
                    >
                      {staffPhoto(c.displayName) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={staffPhoto(c.displayName)!}
                          alt={c.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        c.displayName.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-6">
                        <span className="text-body font-medium text-ink truncate ">
                          {c.displayName}
                        </span>
                        <span className="font-mono text-micro text-ink-subtle">
                          ({c.roleKey === 'supervisor' ? 'Sup' : 'Wait'})
                        </span>
                      </div>

                      {/* Live Workload Telemetry */}
                      {colleagueTabs.length === 0 ? (
                        <span className="font-mono text-micro text-poured flex items-center gap-4 mt-2">
                          <Dot tone="poured" />
                          <span>0 active tabs · Available</span>
                        </span>
                      ) : (
                        <span className="font-mono text-micro text-ink-subtle truncate mt-2">
                          {colleagueTabs.length}{' '}
                          {plural(colleagueTabs.length, 'tab')} (
                          {formatKes(colleagueTotal, { decimals: 'whole' })})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Radio indicator */}
                  <div
                    className={cx(
                      'size-[22px] rounded-dot flex items-center justify-center shrink-0 border transition-all ml-4',
                      isSelected
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-rule-raised/60 text-transparent',
                    )}
                  >
                    <IconCheck size={13} stroke={2.5} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error notification if commit fails */}
        {error ? (
          <div className="rounded-lg border border-stop/30 bg-stop-wash px-16 py-12 text-stop text-body-sm font-medium">
            {error}
          </div>
        ) : null}

        {/* ── 4. Dialog Action Footer ────────────────────────────────── */}
        <OverlayActions>
          <Button variant="ghost" size="lg" onClick={onClose} disabled={submitting}>
            Keep tabs
          </Button>
          <Button
            variant="primary"
            size="xl"
            disabled={!target || activeSelectedIds.length === 0 || submitting}
            loading={submitting}
            onClick={handleCommit}
            icon={IconArrowRight}
          >
            {target
              ? `Hand over ${activeSelectedIds.length} ${plural(activeSelectedIds.length, 'tab')} to ${target.displayName}`
              : `Select a colleague`}
          </Button>
        </OverlayActions>
      </div>
    </Sheet>
  );
}
