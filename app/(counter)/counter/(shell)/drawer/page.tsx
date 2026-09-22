'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { type Cents, ZERO, abs, formatKes, isNegative, isPositive, shillings, sum } from '@bliss/shared/money';
import { countedTotal } from '@bliss/shared/settlement';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { MetricTile } from '@bliss/ui/components/metric-tile';
import { Money } from '@bliss/ui/components/money';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { Dot } from '@bliss/ui/components/status';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowLeft, IconBuildingBank, IconCash, IconChevronRight, IconClockHour4, IconLock, IconReceipt, IconScale } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { PageHeader } from '@/app/_pos/chrome';
import { type OpenTabBlock, closeDrawer, countDrawer, drawerPreflight, dropCash, openDrawer } from '@/lib/pos/counter';
import { useDrawerState } from '@/lib/pos/counter-queries';
import type { DrawerRow } from '@/lib/pos/db';
import { haptic } from '@/lib/pos/haptics';
import { useOutlet } from '@/lib/pos/queries';
import { notify } from '@bliss/ui/components/notices';
import { type Counts, DenominationCounter } from '../../_components/denominations';
import { PANE, Pane } from '../../_components/parts';

type Stage = 'idle' | 'drop' | 'blocked' | 'counting';

/**
 * The drawer. docs/14 section 7.
 *
 * The count is blind: this device is never told what the drawer should hold, and the server says so
 * only once the counted figure is committed. So this page shows the float, the bills taken and the
 * cash sent to the safe, and never the cash taken on bills: with that one figure a cashier could
 * work the expected total out in their head, and the count would stop being a count.
 *
 * Open, drop, count, close. Counting is refused while a tab is still open, because the drawer is
 * closed at the end of the day; the refusal lists those tabs and each one opens straight to settle.
 */
export default function DrawerPage() {
  const state = useDrawerState();
  const outlet = useOutlet();
  const router = useRouter();
  const now = useNow(30_000);
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const [stage, setStage] = useState<Stage>('idle');
  const [floatCounts, setFloatCounts] = useState<Counts>({});
  const [counts, setCounts] = useState<Counts>({});
  const [dropAmount, setDropAmount] = useState('');
  const [blocks, setBlocks] = useState<OpenTabBlock[]>([]);
  const [needsReason, setNeedsReason] = useState<{ needs: boolean; threshold: Cents } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = state?.open ?? null;
  const live = open?.status === 'open';
  const counted = open && open.status !== 'open' && open.varianceCents !== undefined && open.varianceCents !== null ? open : null;
  const floatTotal = countedTotal(floatCounts);
  const countTotal = countedTotal(counts);
  const drops = open ? sum(open.drops.map((d) => d.amountCents)) : ZERO;
  // A count taken before a reload has lost the server's threshold, so any difference asks for a
  // reason: the server accepts one it did not need, and refuses a close that lacks one it did.
  const offCount = counted ? isPositive(counted.varianceCents ?? ZERO) || isNegative(counted.varianceCents ?? ZERO) : false;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  const close = (reason: string | null) =>
    run(async () => {
      if (!counted) return;
      await closeDrawer(counted.id, reason);
      haptic('success');
      notify({ key: 'drawer', title: 'Drawer closed', body: reason ? 'The count and the reason are with the day.' : 'The count is with the day. A new drawer opens with a fresh float.' });
      setStage('idle');
      setNeedsReason(null);
      setCounts({});
    });

  const status = state === undefined ? null : !open ? { tone: 'attention' as const, dot: 'low' as const, text: 'Not open' } : live ? { tone: 'poured' as const, dot: 'poured' as const, text: 'Open' } : { tone: 'accent' as const, dot: 'info' as const, text: 'Counted' };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Drawer"
        facts={
          state === undefined
            ? [{ key: 'r', text: 'Reading this counter' }]
            : [
                state.device ? { key: 'd', text: state.device.label } : { key: 'd', text: 'Device not registered' },
                open ? { key: 'o', text: `open since ${formatTime(open.openedAt, tz)}`, mono: true } : { key: 'o', text: 'no drawer open' },
                state.closedToday.length > 0 ? { key: 'c', text: `${plural(state.closedToday.length, 'drawer')} closed today` } : null,
              ]
        }
        aside={
          status ? (
            <Badge tone={status.tone} className="!rounded-full">
              <Dot tone={status.dot} />
              <span>{status.text}</span>
            </Badge>
          ) : null
        }
      />

      <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
        <div className="flex flex-col gap-16 tablet:gap-24">
          {error ? (
            <InlineNotice tone="stop" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
              {error}
            </InlineNotice>
          ) : null}

          {state === undefined ? null : !open ? (
            /* ── Open: count the float in ────────────────────────────────── */
            <>
              <div className="grid gap-16 tablet:grid-cols-[minmax(0,1fr)_320px] tablet:gap-24">
                <Pane title="Count the float in">
                  <DenominationCounter label="Opening float" counts={floatCounts} onChange={setFloatCounts} />
                </Pane>
                <div className="flex flex-col gap-16">
                  <div className={cx(PANE, 'flex flex-col gap-8 p-16 tablet:p-20')}>
                    <span className="caps text-ink-subtle">Opening float</span>
                    <Money value={floatTotal} size="display" decimals="whole" />
                    <p className="text-body-sm text-ink-muted">Cash cannot be taken on this counter until the drawer is open. M-Pesa and card work without it.</p>
                  </div>
                </div>
              </div>
              {state.closedToday.length > 0 ? <ClosedToday rows={state.closedToday} timezone={tz} /> : null}
            </>
          ) : counted ? (
            /* ── Counted: the server says what it expected ──────────────── */
            <CountResult
              row={counted}
              needsReason={needsReason?.needs ?? offCount}
              threshold={needsReason?.threshold ?? null}
              busy={busy}
              onClose={close}
            />
          ) : stage === 'counting' ? (
            /* ── Count: blind ───────────────────────────────────────────── */
            <div className="grid gap-16 tablet:grid-cols-[minmax(0,1fr)_320px] tablet:gap-24">
              <Pane title="Count what is in the drawer">
                <DenominationCounter label="Drawer count" counts={counts} onChange={setCounts} />
              </Pane>
              <div className={cx(PANE, 'flex h-fit flex-col gap-8 p-16 tablet:sticky tablet:top-0 tablet:p-20')}>
                <span className="caps text-ink-subtle">Counted</span>
                <Money value={countTotal} size="display" decimals="whole" />
                <p className="flex items-start gap-8 text-body-sm text-ink-muted">
                  <IconLock size={16} stroke={ICON_STROKE} aria-hidden="true" className="mt-2 shrink-0" />
                  Bliss shows what it expected once this is committed, not before. A count cannot be taken twice.
                </p>
              </div>
            </div>
          ) : stage === 'blocked' ? (
            /* ── Refused: tabs still open ───────────────────────────────── */
            <Pane title={`${plural(blocks.length, 'tab')} still open`}>
              <p className="px-16 pt-12 text-body text-ink-muted">The drawer is counted once every tab is settled. Settle these first, or hand them to whoever is closing.</p>
              <ul className="mt-8">
                {blocks.map((b) => (
                  <li key={b.tabId} className="border-t border-rule-raised/20">
                    <button type="button" onClick={() => router.push(`/counter/tabs/${b.tabId}`)} className="flex min-h-row-floor w-full items-center gap-12 px-16 text-left press-feedback hover:bg-sunken/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-ink">{b.label}</span>
                        <span className="block text-body-sm text-ink-subtle">
                          {b.waiter}
                          {b.tabNumber ? ` · Tab ${b.tabNumber}` : ''}
                        </span>
                      </span>
                      <Money value={b.totalCents} size="num" tone="money" decimals="whole" />
                      <IconChevronRight size={18} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                    </button>
                  </li>
                ))}
              </ul>
            </Pane>
          ) : stage === 'drop' ? (
            /* ── A drop to the safe ─────────────────────────────────────── */
            <div className={cx(PANE, 'flex max-w-[560px] flex-col gap-16 p-16 tablet:p-24')}>
              <div>
                <h2 className="text-title text-ink">Cash to the safe</h2>
                <p className="mt-4 text-body text-ink-muted">Take it out of the drawer first, then record it here with the reason.</p>
              </div>
              <TextField label="Amount" inputMode="numeric" mono value={dropAmount} onChange={(e) => setDropAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} helper="Whole shillings." />
              <ReasonForm
                quickReasons={['To the safe', 'Bank run', 'Float to the other till']}
                confirmLabel={dropAmount ? `Record ${formatKes(shillings(Number(dropAmount)), { decimals: 'whole' })}` : 'Record the drop'}
                cancelLabel="Back"
                onCancel={() => setStage('idle')}
                onConfirm={async ({ reason }) => {
                  if (!dropAmount) throw new Error('Enter the amount going to the safe.');
                  await dropCash(shillings(Number(dropAmount)), reason);
                  haptic('success');
                  notify({ key: 'drawer:drop', title: `${formatKes(shillings(Number(dropAmount)), { decimals: 'whole' })} to the safe`, body: 'Recorded against this drawer, with the reason.' });
                  setDropAmount('');
                  setStage('idle');
                }}
              />
            </div>
          ) : (
            /* ── Open: the day so far ───────────────────────────────────── */
            <>
              <section aria-label="This drawer" className="grid grid-cols-2 gap-8 pad:gap-16 desktop:grid-cols-4">
                <MetricTile label="Opening float" icon={IconCash} tone="money" value={<Money value={open.openingFloatCents} size="num-lg" decimals="whole" />} subtitle={`Opened ${formatTime(open.openedAt, tz)}`} />
                <MetricTile label="Open for" icon={IconClockHour4} tone="accent" value={<span className="font-mono tabular text-num-lg text-ink">{formatElapsed(now - open.openedAt)}</span>} subtitle="Since the float went in" />
                <MetricTile label="Bills here" icon={IconReceipt} tone="poured" value={<span className="font-mono tabular text-num-lg text-ink">{open.cashBills}</span>} subtitle="Settled on this counter" />
                <MetricTile label="To the safe" icon={IconBuildingBank} tone="neutral" value={<Money value={drops} size="num-lg" decimals="whole" />} subtitle={open.drops.length === 0 ? 'Nothing taken out' : plural(open.drops.length, 'drop')} />
              </section>

              <Pane title="Cash to the safe" aside={open.drops.length > 0 ? <Money value={drops} size="num-sm" tone="muted" /> : null}>
                {open.drops.length === 0 ? (
                  <p className="px-16 py-16 text-body text-ink-muted">Nothing has left the drawer. Record a drop whenever cash goes to the safe, so the count at close matches.</p>
                ) : (
                  <ul>
                    {open.drops.map((d) => (
                      <li key={d.id} className="flex min-h-row items-center gap-12 border-t border-rule-raised/20 px-16 first:border-t-0">
                        <span className="w-[48px] shrink-0 font-mono tabular text-num-sm text-ink-subtle">{formatTime(d.occurredAt, tz)}</span>
                        <span className="min-w-0 flex-1 truncate text-body text-ink-muted">{d.reason}</span>
                        <Money value={d.amountCents} size="num-sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </Pane>

              <p className="flex items-start gap-8 text-body-sm text-ink-subtle">
                <IconLock size={16} stroke={ICON_STROKE} aria-hidden="true" className="mt-2 shrink-0" />
                The cash taken on bills is not shown here. The count at close is blind, so the drawer is counted, not checked against a figure.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── The dock's actions follow the stage ───────────────────────── */}
      {state && !open ? (
        <BaseAction>
          <Button
            variant="primary"
            size="xl"
            icon={IconCash}
            loading={busy}
            onClick={() =>
              void run(async () => {
                await openDrawer(floatTotal);
                haptic('success');
                notify({ key: 'drawer', title: 'Drawer open', body: `Float of ${formatKes(floatTotal, { decimals: 'whole' })}. Cash can be taken on this counter now.` });
                setFloatCounts({});
              })
            }
          >
            Open with {formatKes(floatTotal, { decimals: 'whole' })}
          </Button>
        </BaseAction>
      ) : live && stage === 'idle' ? (
        <BaseAction>
          <Button variant="secondary" size="xl" icon={IconBuildingBank} onClick={() => setStage('drop')}>
            Cash to safe
          </Button>
          <Button
            variant="primary"
            size="xl"
            icon={IconScale}
            loading={busy}
            onClick={() =>
              void run(async () => {
                const openTabs = await drawerPreflight();
                if (openTabs.length > 0) {
                  haptic('warning');
                  notify({ tone: 'warning', key: 'drawer', title: 'Not yet', body: `${plural(openTabs.length, 'tab')} still open. Settle them before the count.` });
                  setBlocks(openTabs);
                  setStage('blocked');
                  return;
                }
                setCounts({});
                setStage('counting');
              })
            }
          >
            Count and close
          </Button>
        </BaseAction>
      ) : live && stage === 'blocked' ? (
        <BaseAction>
          <Button variant="secondary" size="xl" icon={IconArrowLeft} onClick={() => setStage('idle')}>
            Back to the drawer
          </Button>
        </BaseAction>
      ) : live && stage === 'counting' ? (
        <BaseAction>
          <Button variant="ghost" size="xl" onClick={() => setStage('idle')}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="xl"
            icon={IconLock}
            loading={busy}
            onClick={() =>
              void run(async () => {
                const result = await countDrawer(open.id, countTotal);
                haptic(result.needsReason ? 'warning' : 'success');
                notify({ tone: result.needsReason ? 'warning' : 'success', key: 'drawer', title: 'Count committed', body: result.needsReason ? 'The count is off by more than the allowance. Give the reason to close.' : 'Close the drawer to finish the day.' });
                setNeedsReason({ needs: result.needsReason, threshold: result.thresholdCents });
              })
            }
          >
            Commit {formatKes(countTotal, { decimals: 'whole' })}
          </Button>
        </BaseAction>
      ) : counted && !(needsReason?.needs ?? offCount) ? (
        <BaseAction>
          <Button variant="primary" size="xl" icon={IconLock} loading={busy} onClick={() => void close(null)}>
            Close the drawer
          </Button>
        </BaseAction>
      ) : null}
    </div>
  );
}

/** What the server says once the count is locked: what it expected, and the difference. */
function CountResult({ row, needsReason, threshold, busy, onClose }: { row: DrawerRow; needsReason: boolean; threshold: Cents | null; busy: boolean; onClose: (reason: string | null) => void }) {
  const variance = row.varianceCents ?? ZERO;
  const over = isPositive(variance);
  const short = isNegative(variance);
  const word = over ? 'Over' : short ? 'Short' : 'Exact';

  return (
    <div className="flex flex-col gap-16 tablet:gap-24">
      <section aria-label="The count" className="grid grid-cols-1 gap-8 pad:grid-cols-3 pad:gap-16">
        <MetricTile label="Counted" icon={IconCash} tone="neutral" value={<Money value={row.countedCashCents ?? ZERO} size="num-lg" decimals="whole" />} subtitle="What is in the drawer" />
        <MetricTile label="Expected" icon={IconScale} tone="accent" value={<Money value={row.expectedCashCents ?? ZERO} size="num-lg" decimals="whole" />} subtitle="Float, plus cash taken, less drops" />
        <MetricTile
          label={word}
          icon={IconScale}
          tone={over || short ? 'low' : 'poured'}
          value={<Money value={abs(variance)} size="num-lg" tone={over || short ? 'attention' : 'poured'} decimals="whole" />}
          subtitle={over || short ? 'The difference, recorded against this drawer' : 'The drawer matches'}
        />
      </section>

      {needsReason ? (
        <div className={cx(PANE, 'flex max-w-[640px] flex-col gap-16 p-16 tablet:p-24')}>
          <p className="text-body text-ink-muted">
            {threshold ? `This is more than ${formatKes(threshold, { decimals: 'whole' })} out. ` : ''}Say what happened before the drawer closes. The reason stays with this drawer for the manager.
          </p>
          <ReasonForm
            quickReasons={['Miscount at the till', 'Change given wrong', 'Float taken for the other till']}
            confirmLabel="Close the drawer"
            cancelLabel="Not yet"
            onCancel={() => {}}
            onConfirm={async ({ reason }) => onClose(reason)}
          />
        </div>
      ) : (
        <p className="text-body text-ink-muted">{busy ? 'Closing the drawer.' : 'Close the drawer to finish the day on this counter.'}</p>
      )}
    </div>
  );
}

function ClosedToday({ rows, timezone }: { rows: readonly DrawerRow[]; timezone: string }) {
  return (
    <Pane title="Closed today">
      <ul>
        {rows.map((r) => {
          const v = r.varianceCents ?? ZERO;
          return (
            <li key={r.id} className="flex min-h-row items-center gap-12 border-t border-rule-raised/20 px-16 first:border-t-0">
              <span className="w-[48px] shrink-0 font-mono tabular text-num-sm text-ink-subtle">{r.closedAt ? formatTime(r.closedAt, timezone) : ''}</span>
              <span className="min-w-0 flex-1 truncate text-body text-ink-muted">
                Counted {formatKes(r.countedCashCents ?? ZERO, { decimals: 'whole' })}
                {r.varianceReason ? ` · ${r.varianceReason}` : ''}
              </span>
              <span className={cx('shrink-0 font-mono tabular text-num-sm', isPositive(v) || isNegative(v) ? 'text-low' : 'text-poured')}>
                {isPositive(v) ? 'Over ' : isNegative(v) ? 'Short ' : 'Exact'}
                {isPositive(v) || isNegative(v) ? formatKes(abs(v), { decimals: 'whole' }) : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </Pane>
  );
}
