'use client';

import { formatElapsed, formatTime, plural } from '@bliss/shared/format';
import { type Cents, ZERO, formatKes, isPositive, subtract, sum } from '@bliss/shared/money';
import { displaySeatLabel } from '@bliss/shared/seats';
import { amountDue, evenShares } from '@bliss/shared/settlement';
import { Badge } from '@bliss/ui/components/badge';
import { Button } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { InlineNotice, Skeleton } from '@bliss/ui/components/feedback';
import { Stepper } from '@bliss/ui/components/fields';
import { TicketLineView } from '@bliss/ui/components/floor/ticket';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { SeatChip } from '@bliss/ui/components/seat-chip';
import { Dot } from '@bliss/ui/components/status';
import { useNow } from '@bliss/ui/hooks';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowLeft, IconArrowRight, IconCheck, IconDoorExit, IconPrinter } from '@tabler/icons-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { PageHeader } from '@/app/_pos/chrome';
import { type TenderDraft, settle } from '@/lib/pos/counter';
import { useDrawerState, useSettleView } from '@/lib/pos/counter-queries';
import { setMeta } from '@/lib/pos/db';
import { newId } from '@/lib/pos/ids';
import { useOutlet } from '@/lib/pos/queries';
import { clear } from '@/lib/pos/actions';
import { haptic } from '@/lib/pos/haptics';
import { isSeated } from '@bliss/shared/trade';
import { notify } from '@bliss/ui/components/notices';
import { PANE, Quiet } from '../../../_components/parts';
import { TENDER_ICON, TENDER_WORD, TenderPanel } from '../../../_components/tender-panel';

type Scope = 'tab' | 'seat' | 'even_split';

/**
 * Settle a tab. docs/14 section 6.
 *
 * The bill on the left reads like the ticket the waiter built: one pane per seat, the same photos,
 * quantities and poured times. The tender panel sits beside it from a tablet held upright, so the
 * cashier's eyes move left to read and right to take the money, and never scroll between the two.
 *
 * Three ways to cut a bill and one way to pay it. The device works the figure out to show it; the
 * server works it out again to accept it and refuses the bill if the two disagree, so nothing here
 * can quietly charge the wrong amount.
 *
 * The even split follows docs/05 2.7: the first share carries every remaining line and fixes the
 * group total, and each later share is that total divided again. The extra cents land on the first
 * shares, never on the last guest.
 */
export default function SettleTabPage() {
  const { tabId } = useParams<{ tabId: string }>();
  const router = useRouter();
  const view = useSettleView(tabId);
  const drawer = useDrawerState();
  const outlet = useOutlet();
  const now = useNow(30_000);
  const tz = outlet?.timezone ?? 'Africa/Nairobi';

  const [scope, setScope] = useState<Scope>('tab');
  const [seatId, setSeatId] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState(2);
  const [tenders, setTenders] = useState<TenderDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ change: Cents; paid: Cents; billId: string } | null>(null);

  // A split already under way owns the screen: the rest of the tab is spoken for until it is done.
  const splitGroupId = view?.split?.groupId ?? null;
  const splitWays = view?.split?.count ?? null;
  useEffect(() => {
    if (!splitGroupId || splitWays === null) return;
    setScope('even_split');
    setSplitCount(splitWays);
  }, [splitGroupId, splitWays]);

  // One seat starts on the first seat that still has something to pay.
  const seatGroups = useMemo(() => view?.groups.filter((g) => g.seat) ?? [], [view]);
  useEffect(() => {
    if (scope === 'seat' && (!seatId || !seatGroups.some((g) => g.seat?.id === seatId))) setSeatId(seatGroups[0]?.seat?.id ?? null);
  }, [scope, seatId, seatGroups]);

  const plan = useMemo(() => {
    if (!view) return null;
    if (scope === 'seat') {
      const group = view.groups.find((g) => g.seat?.id === seatId);
      return { subtotal: group?.subtotal ?? ZERO, lineIds: group?.lines.map((l) => l.line.id) ?? [], seatId: seatId ?? null, split: null, caption: group?.seat ? `Seat ${group.seat.seatNo}` : 'One seat' };
    }
    if (scope === 'even_split') {
      const settledShares = view.split?.settled ?? 0;
      const count = view.split?.count ?? splitCount;
      const groupTotal = view.split?.total ?? view.remaining;
      const share = evenShares(groupTotal, count)[settledShares] ?? ZERO;
      return {
        subtotal: share,
        // The first share carries the lines; the others carry none, and the server checks that.
        lineIds: settledShares === 0 ? view.remainingLineIds : [],
        seatId: null,
        split: { groupId: view.split?.groupId ?? null, index: settledShares, count },
        caption: `Share ${settledShares + 1} of ${count}`,
      };
    }
    return { subtotal: view.remaining, lineIds: view.remainingLineIds, seatId: null, split: null, caption: 'Whole tab' };
  }, [view, scope, seatId, splitCount]);

  const due = plan ? amountDue(plan.subtotal).due : ZERO;
  const recorded = sum(tenders.map((t) => t.amount));
  const covered = plan !== null && isPositive(plan.subtotal) && !isPositive(subtract(due, recorded));
  const drawerOpen = Boolean(drawer?.open && drawer.open.status === 'open');
  const nothingLeft = view !== undefined && view !== null && view.groups.length === 0 && !view.split;

  const changeScope = (next: Scope) => {
    setScope(next);
    setTenders([]);
    setResult(null);
    setError(null);
  };

  const onSettle = async () => {
    if (!plan || !view || busy || !covered) return;
    setBusy(true);
    setError(null);
    try {
      const groupId = plan.split ? (plan.split.groupId ?? newId(null)) : null;
      if (plan.split && groupId) await setMeta(`split:${tabId}`, { groupId, count: plan.split.count });
      const billId = await settle({
        scope,
        tabId,
        tabSeatId: plan.seatId,
        lineIds: plan.lineIds,
        items: [],
        split: plan.split && groupId ? { groupId, index: plan.split.index, count: plan.split.count } : null,
        subtotal: plan.subtotal,
        tenders,
      });
      const change = sum(tenders.map((t) => (t.tendered ? subtract(t.tendered, t.amount) : ZERO)));
      setResult({ change, paid: due, billId });
      setTenders([]);
      haptic('success');
      notify({
        key: `settle:${tabId}`,
        title: `${plan.caption === 'Whole tab' ? view.label : `${view.label} · ${plan.caption}`} settled`,
        body: `${formatKes(due, { decimals: 'whole' })} by ${[...new Set(tenders.map((t) => TENDER_WORD[t.kind]))].join(' and ')}.${isPositive(change) ? ` Give ${formatKes(change, { decimals: 'whole' })} change.` : ''}`,
        holdMs: isPositive(change) ? 8000 : 4000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That bill did not go through. Nothing was settled.');
    } finally {
      setBusy(false);
    }
  };

  if (view === null) {
    return (
      <Quiet
        title="This tab is not on this counter"
        body="It may have been settled already, or it has not reached this device yet."
        action={
          <Button variant="secondary" size="lg" icon={IconArrowLeft} onClick={() => router.push('/counter/tabs')}>
            Back to tabs
          </Button>
        }
      />
    );
  }

  return (
    // On a phone the bill and the payment are one scroll, the payment under the bill; from a tablet
    // held upright they sit side by side, each scrolling on its own.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto pad:flex-row pad:overflow-hidden">
      {/* ── The bill ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 shrink-0 flex-col pad:min-h-0 pad:flex-1 pad:shrink">
        <PageHeader
          title={view?.label ?? 'Tab'}
          facts={
            view
              ? [
                  view.tabNumber ? { key: 'n', text: `Tab ${view.tabNumber}` } : null,
                  view.waiter ? { key: 'w', text: view.waiter } : null,
                  { key: 'o', text: `open ${formatElapsed(now - view.openedAt)}`, mono: true },
                  view.waiting > 0 ? { key: 'p', text: `${view.waiting} still to pour` } : null,
                ]
              : []
          }
          aside={
            <Button variant="ghost" size="md" icon={IconArrowLeft} onClick={() => router.push('/counter/tabs')}>
              Tabs
            </Button>
          }
        >
          <div className="flex flex-wrap items-center gap-12">
            <Segmented
              label="What this bill covers"
              size="md"
              value={scope}
              onChange={changeScope}
              options={[
                { value: 'tab', label: 'Whole tab', disabled: Boolean(view?.split) },
                { value: 'seat', label: 'One seat', disabled: seatGroups.length === 0 || Boolean(view?.split) },
                { value: 'even_split', label: 'Even split' },
              ]}
            />
            {scope === 'even_split' ? (
              view?.split ? (
                <Badge tone="accent" className="!rounded-full">
                  Share {view.split.settled + 1} of {view.split.count}
                </Badge>
              ) : (
                <span className="flex items-center gap-8">
                  <span className="text-body-sm text-ink-muted">Split</span>
                  <Stepper value={splitCount} min={2} max={12} onChange={setSplitCount} label="How many ways to split" size="md" />
                  <span className="text-body-sm text-ink-muted">ways</span>
                </span>
              )
            ) : null}
          </div>
        </PageHeader>

        <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
          {view === undefined ? (
            <div className="flex flex-col gap-12">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[160px] rounded-[20px]" />
              ))}
            </div>
          ) : view.groups.length === 0 ? (
            <Quiet title="Everything on this tab is settled" body="The bills taken are listed below. The tab closes on the Floor as soon as the last one lands." />
          ) : (
            <div className="flex flex-col gap-12 tablet:gap-16">
              {view.groups.map((group) => {
                const chosen = scope === 'seat' && group.seat?.id === seatId;
                const dimmed = scope === 'seat' && !chosen;
                return (
                  <section
                    key={group.key}
                    aria-label={group.seat ? `Seat ${group.seat.seatNo}` : 'Shared'}
                    className={cx(PANE, 'overflow-hidden', chosen && 'border-accent/60', dimmed && 'opacity-50')}
                  >
                    <header className="flex min-h-control-lg items-center justify-between gap-12 border-b border-rule-raised/30 px-16 py-8">
                      {group.seat && scope === 'seat' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSeatId(group.seat!.id);
                            setTenders([]);
                          }}
                          aria-pressed={chosen}
                          className="flex items-center gap-8 rounded-sm press-feedback"
                        >
                          <SeatChip seat={group.seat.seatNo} label={group.seat.label} />
                          <span className="text-body text-ink">{group.seat.label ? displaySeatLabel(group.seat.label) : `Seat ${group.seat.seatNo}`}</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-8">
                          <SeatChip seat={group.seat?.seatNo ?? 'shared'} label={group.seat?.label ?? null} />
                          <span className="text-body text-ink">{group.seat ? (group.seat.label ? displaySeatLabel(group.seat.label) : `Seat ${group.seat.seatNo}`) : 'Shared'}</span>
                        </span>
                      )}
                      <Money value={group.subtotal} size="num" tone="muted" />
                    </header>
                    <ul className="px-12">
                      {group.lines.map(({ line, name, modifiers, imageUrl, deliveredAt }) => (
                        <li key={line.id} className="border-b border-rule-raised/20 last:border-b-0">
                          <TicketLineView
                            qty={line.qty}
                            name={name}
                            lineTotal={line.lineTotalCents}
                            state={line.status === 'served' ? (deliveredAt ? 'served' : 'poured') : 'waiting'}
                            detail={[...modifiers, line.note].filter(Boolean).join(' · ') || null}
                            pouredAt={line.servedAt ? formatTime(line.servedAt, tz) : null}
                            servedAt={deliveredAt ? formatTime(deliveredAt, tz) : null}
                            imageUrl={imageUrl}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {view && view.bills.length > 0 ? (
            <section aria-label="Bills already taken" className={cx(PANE, 'mt-16 overflow-hidden tablet:mt-24')}>
              <header className="flex min-h-control-lg items-center justify-between gap-12 border-b border-rule-raised/30 px-16 py-8">
                <h2 className="caps text-ink-subtle">Already settled</h2>
                <Money value={sum(view.bills.map((b) => b.totalCents))} size="num-sm" tone="subtle" />
              </header>
              <ul>
                {view.bills.map((b) => (
                  <li key={b.id} className="flex min-h-row items-center gap-12 border-b border-rule-raised/20 px-16 last:border-b-0">
                    <span className="flex size-control-sm shrink-0 items-center justify-center rounded-dot bg-poured/15 text-poured">
                      <IconCheck size={14} stroke={ICON_STROKE} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink-muted">{b.seatNo ? `Seat ${b.seatNo}` : b.scope === 'even_split' ? 'Split share' : 'Whole tab'}</span>
                    <span className="hidden items-center gap-6 compact:flex">
                      {b.tenders.map((t) => {
                        const Glyph = TENDER_ICON[t.kind];
                        return (
                          <span key={t.id} className="flex items-center gap-4 rounded-dot bg-sunken/60 px-8 py-2 text-micro text-ink-subtle">
                            <Glyph size={12} stroke={ICON_STROKE} aria-hidden="true" />
                            {TENDER_WORD[t.kind]}
                          </span>
                        );
                      })}
                    </span>
                    <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{b.settledAt ? formatTime(b.settledAt, tz) : ''}</span>
                    <Money value={b.totalCents} size="num-sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/* ── The money ──────────────────────────────────────────────────── */}
      <aside
        aria-label="Take payment"
        className="flex shrink-0 flex-col gap-16 border-t border-rule-raised/30 bg-sunken/30 p-12 backdrop-blur-glass pad:w-[380px] pad:overflow-y-auto pad:border-l pad:border-t-0 pad:p-16 tablet:w-panel-tender tablet:gap-20 tablet:p-24"
      >
        {result ? (
          <div className="flex flex-col gap-16">
            <div className="flex flex-col gap-12 rounded-[20px] bg-poured-wash p-16 tablet:p-20">
              <p className="flex items-center gap-8 text-body-lg text-poured">
                <IconCheck size={20} stroke={ICON_STROKE} aria-hidden="true" />
                Bill settled · {formatKes(result.paid, { decimals: 'whole' })}
              </p>
              {isPositive(result.change) ? (
                <div>
                  <span className="caps text-ink-subtle">Change to give</span>
                  <Money value={result.change} size="display" tone="money" decimals="whole" />
                </div>
              ) : (
                <p className="text-body text-ink-muted">No change to give.</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="xl"
              icon={IconPrinter}
              onClick={() => window.open(`/print/bill/${result.billId}`, '_blank')}
            >
              Print Final Receipt
            </Button>
            {nothingLeft ? (
              <div className="flex flex-col gap-12">
                <p className="text-body text-ink-muted">
                  Nothing is left on {view?.label ?? 'this tab'}. The table stays theirs until they leave; clear it then, here or on the Floor.
                </p>
                {view && isSeated(view) ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={IconDoorExit}
                    onClick={async () => {
                      if (await clear(tabId, view.label)) router.push('/counter/tabs');
                    }}
                  >
                    Guests are leaving · clear the table
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-body text-ink-muted">
                {view?.split ? `Share ${view.split.settled + 1} of ${view.split.count} is next.` : `${formatKes(view?.remaining ?? ZERO, { decimals: 'whole' })} is still open on this tab.`}
              </p>
            )}
          </div>
        ) : (
          <>
            {error ? (
              <InlineNotice tone="stop" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
                {error}
              </InlineNotice>
            ) : null}
            {view && view.waiting > 0 ? (
              <p className="flex items-center gap-8 rounded-md bg-low/10 px-12 py-8 text-body-sm text-low">
                <Dot tone="low" />
                {plural(view.waiting, 'line')} on this tab {view.waiting === 1 ? 'is' : 'are'} still to pour.
              </p>
            ) : null}
            <div className={`${PANE} p-16 tablet:p-20`}>
              <TenderPanel key={`${scope}:${seatId ?? ''}:${view?.split?.settled ?? 0}`} due={due} caption={plan?.caption} tenders={tenders} onChange={setTenders} drawerOpen={drawerOpen} disabled={!isPositive(due)} />
            </div>
          </>
        )}
      </aside>

      <BaseAction>
        {result ? (
          nothingLeft ? (
            <Button variant="primary" size="xl" icon={IconArrowLeft} onClick={() => router.push('/counter/tabs')}>
              Back to tabs
            </Button>
          ) : (
            <Button variant="primary" size="xl" icon={IconArrowRight} iconPosition="end" onClick={() => setResult(null)}>
              {view?.split ? 'Next share' : 'Settle the rest'}
            </Button>
          )
        ) : (
          <Button variant="primary" size="xl" loading={busy} disabled={!covered} onClick={() => void onSettle()}>
            Settle {formatKes(due, { decimals: 'whole' })}
          </Button>
        )}
      </BaseAction>
    </div>
  );
}
