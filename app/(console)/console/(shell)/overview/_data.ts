import 'server-only';

import { type Cents, ZERO, add, compare, sum } from '@bliss/shared/money';
import { addDays } from '@bliss/shared/time';
import * as health from '@/modules/health/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as procurement from '@/modules/procurement/service';
import * as reporting from '@/modules/reporting/service';
import * as settlement from '@/modules/settlement/service';
import * as trade from '@/modules/trade/service';
import { dataset } from '@/modules/_data/source';

/**
 * Everything the Overview shows, read once per render: the night in view (tonight while it trades,
 * last night otherwise), what is on the floor now, the week behind it, the money and the stock, the
 * people on shift and the app's own health. Each section of the page takes its slice of this.
 */
export async function loadOverview() {
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const tz = outlet.timezone;
  const now = Date.now();
  const { date, live } = reporting.nightInView();
  const clock = reporting.clock();

  const headline = reporting.headline(date);
  const summary = reporting.salesSummary(date, date, { from: addDays(date, -7), to: addDays(date, -7) });
  const week = reporting.salesByDay(addDays(date, -6), date);

  // What is on the floor this moment.
  const open = trade.openTabs();
  const floor = {
    tabs: open.length,
    value: sum(open.map((t) => t.total)),
    guests: open.reduce((n, t) => n + t.tab.guestCount, 0),
    pending: open.reduce((n, t) => n + t.pendingCount, 0),
    top: [...open]
      .sort((a, b) => compare(b.total, a.total))
      .slice(0, 6)
      .map((t) => ({ id: t.tab.id, label: t.tableLabel, zone: t.zoneName, guests: t.tab.guestCount, total: t.total, openedAt: t.tab.openedAt, lastFiredAt: t.lastFiredAt, pending: t.pendingCount, lines: t.lineCount, waiter: t.tab.openedBy ? identity.displayName(t.tab.openedBy) : null })),
  };

  // The money: how it was paid, and each drawer of the night.
  const tenders = settlement.tenderMix(date, date).filter((t) => t.amount > 0n);
  const drawers = settlement.drawerSessionsBetween(date, date).map((s) => {
    const p = settlement.drawerProjection(s);
    const drops = p.drops;
    const cashIn = sum(drops.filter((d) => d.amountCents > 0n).map((d) => d.amountCents));
    const cashOut = sum(drops.filter((d) => d.amountCents < 0n).map((d) => d.amountCents));
    return {
      id: s.id,
      device: identity.devices().find((d) => d.id === s.deviceId)?.label ?? 'Counter',
      openedBy: identity.displayName(s.openedBy),
      openedAt: s.openedAt,
      status: s.status,
      float: s.openingFloatCents,
      cashBills: p.cashBills,
      movements: drops.length,
      cashIn,
      cashOut,
      variance: 'varianceCents' in p ? (p.varianceCents ?? null) : null,
      closedAt: 'closedAt' in p ? (p.closedAt ?? null) : null,
    };
  });

  // The people working now.
  const summaries = identity.staffSummaries();
  // Everyone on shift now; with nobody on, the night in view's shifts, so the section still says who worked.
  const onNow = dataset().shifts.filter((s) => s.status === 'open');
  const shifts = (onNow.length > 0 ? onNow : trade.shiftsOn(date))
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const who = summaries.find((x) => x.id === s.staffId);
      return { id: s.id, staffId: s.staffId, name: who?.displayName ?? identity.displayName(s.staffId), role: who?.roleName ?? '', colourIndex: who?.colourIndex ?? 0, avatarUrl: who?.avatarUrl ?? null, startedAt: s.startedAt, endedAt: s.endedAt, tabs: s.tabsOpened, sales: s.salesCents };
    });

  // Stock that needs a person, and the app's own vital signs.
  const report = await health.report();
  const reorder = procurement.reorderSuggestions().filter((s) => s.suggestedQty > 0);
  const categories = reporting
    .salesByCategory(date, date)
    .filter((c) => c.value > 0n)
    .sort((a, b) => compare(b.value, a.value));

  return {
    now,
    tz,
    viewer: actor.staff.displayName,
    outletName: outlet.name,
    date,
    live,
    tradingNow: clock.tradingInProgress,
    headline,
    summary,
    hours: reporting.salesByHour(date),
    usualHours: usualHours(date),
    week,
    attention: reporting.needsAttention(),
    movers: reporting.topMovers(date, date, 6),
    variance: reporting.latestCommittedVariance(),
    floor,
    tenders,
    tendersTotal: tenders.reduce<Cents>((a, t) => add(a, t.amount), ZERO),
    drawers,
    shifts,
    onShift: onNow.length,
    categories,
    stock: { ...report.stock, reorder: reorder.length, reorderCost: sum(reorder.map((r) => r.estimatedCost)), belowZero: inventory.belowZeroCount() },
    health: { score: report.score, status: report.status, counts: report.counts, stations: report.stations, alerts: report.alerts, attention: report.attention.length },
  };
}

export type OverviewData = Awaited<ReturnType<typeof loadOverview>>;

/**
 * The same weekday over the four weeks before, hour by hour, averaged over the ones that traded: what
 * a usual night of this kind looks like, to set tonight against.
 */
function usualHours(date: string) {
  const nights = [7, 14, 21, 28].map((n) => reporting.salesByHour(addDays(date, -n))).filter((h) => h.some((x) => x.value > 0n));
  if (nights.length === 0) return null;
  return nights[0]!.map((h, i) => ({ hour: h.hour, value: Math.round(nights.reduce((a, n) => a + Number(n[i]!.value), 0) / nights.length) }));
}
