import 'server-only';

import type { AuditEvent } from '@bliss/shared/domain';
import { formatTime, formatWeekday, formatIsoDate } from '@bliss/shared/format';
import { type Cents, ZERO, abs, cents, compare, formatFigure, isNegative, isPositive, sum } from '@bliss/shared/money';
import { businessDate } from '@bliss/shared/time';
import { on } from '../_data/events';
import * as availability from '../availability/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as inventory from '../inventory/service';
import * as reporting from '../reporting/service';
import * as settlement from '../settlement/service';
import * as trade from '../trade/service';
import { enqueue, settings } from './service';

/**
 * What turns an event into a WhatsApp alert, docs/20. Each runs inside the write that raised the
 * event, so the alert is queued with it; the sender delivers it after the response.
 */

const money = (value: Cents) => formatFigure(value, { decimals: 'whole' });
const tz = () => identity.outlet().timezone;
const today = () => {
  const o = identity.outlet();
  return businessDate(Date.now(), o.timezone, o.businessDayCutover);
};

function placeOf(tabId: string | null | undefined): string {
  const tab = tabId ? trade.tabById(tabId) : null;
  return tab ? trade.summarise(tab).tableLabel : 'a quick sale';
}

function onVoid(event: AuditEvent) {
  const line = trade.readTables().lines.find((l) => l.id === event.entityId);
  if (!line) return;
  const amount = line.lineTotalCents;
  if (compare(amount, settings().voidAlertCents) < 0) return;
  const item = catalogue.variantById(line.productVariantId)?.name ?? 'an item';
  enqueue({ kind: 'void_refund', key: `void:${line.id}`, businessDate: today(), params: ['A void', money(amount), `${placeOf(line.tabId)}, ${line.qty} x ${item}`, identity.displayName(event.actorStaffId), event.reason ?? 'none'] });
}

function onBill(event: AuditEvent, what: 'A refund' | 'A voided bill') {
  const bill = settlement.billById(event.entityId);
  if (!bill) return;
  const after = (event.after ?? {}) as { refundCents?: string };
  const amount = what === 'A refund' && after.refundCents ? cents(after.refundCents) : bill.totalCents;
  if (compare(amount, settings().voidAlertCents) < 0) return;
  enqueue({ kind: 'void_refund', key: `${what === 'A refund' ? 'refund' : 'billvoid'}:${event.id}`, businessDate: bill.businessDate, params: [what, money(amount), `${placeOf(bill.tabId)}, bill ${bill.billNumber}`, identity.displayName(event.actorStaffId), event.reason ?? 'none'] });
}

function onDrawerClosed(event: AuditEvent) {
  const session = settlement.drawerSessions().find((s) => s.id === event.entityId);
  if (!session) return;
  const outlet = identity.outlet();
  const variance = session.varianceCents ?? ZERO;
  if (compare(abs(variance), outlet.drawerVarianceThresholdCents) > 0) {
    const device = identity.devices().find((d) => d.id === session.deviceId)?.label ?? 'A counter';
    enqueue({
      kind: 'drawer_variance',
      key: `drawer:${session.id}`,
      businessDate: session.businessDate,
      params: [device, isPositive(variance) ? 'over' : 'short', money(abs(variance)), money(session.countedCashCents ?? ZERO), money(session.expectedCashCents ?? ZERO), identity.displayName(session.closedBy), session.varianceReason ?? 'no reason needed'],
    });
  }
  // The last drawer of the night closing is the night's end: send its summary.
  const stillOpen = settlement.drawerSessions().some((s) => s.businessDate === session.businessDate && s.status !== 'closed');
  if (!stillOpen) queueNightSummary(session.businessDate);
}

function onCleared(event: AuditEvent) {
  const s = (event.before ?? {}) as { tabs?: number; bills?: number; shifts?: number };
  enqueue({ kind: 'trade_cleared', key: `cleared:${event.id}`, businessDate: today(), params: [identity.displayName(event.actorStaffId), formatTime(event.occurredAt, tz()), `${s.tabs ?? 0} tabs, ${s.bills ?? 0} bills, ${s.shifts ?? 0} shifts`, event.reason ?? 'none'] });
}

/** A counted item that has just run out, once per item a night. Items never counted do not run out. */
function onFired(payload: { tabId: string; lineIds: string[] }) {
  const lines = trade.readTables().lines.filter((l) => payload.lineIds.includes(l.id));
  const date = today();
  for (const variantId of new Set(lines.map((l) => l.productVariantId))) {
    const entry = availability.evaluate(variantId);
    if (entry.state !== 'finished' || entry.reason === 'hold') continue;
    const stock = catalogue.stockVariantFor(variantId);
    if (!stock || !inventory.stockRecorded(stock.stockVariantId)) continue;
    const variant = catalogue.variantById(variantId);
    enqueue({ kind: 'stock_out', key: `stock:${date}:${variant?.productId ?? variantId}`, businessDate: date, params: [variant?.name ?? 'An item', formatTime(Date.now(), tz())] });
  }
}

/** The night in one message: sales, how it was paid, what was voided, and how the drawers closed. */
export function queueNightSummary(date: string): number {
  const bills = settlement.billsOn(date).filter((b) => b.status !== 'voided');
  if (bills.length === 0) return 0;
  const mix = settlement.tenderMix(date, date);
  const by = (kind: string) => mix.find((m) => m.kind === kind)?.amount ?? ZERO;
  const voided = sum(trade.readTables().lines.filter((l) => l.status === 'voided' && l.voidedAt && businessDate(l.voidedAt, tz(), identity.outlet().businessDayCutover) === date).map((l) => l.lineTotalCents));
  const drawers = settlement.drawerSessions().filter((s) => s.businessDate === date);
  const drawerText =
    drawers.length === 0
      ? 'none opened'
      : drawers
          .map((s) => {
            const label = identity.devices().find((d) => d.id === s.deviceId)?.label ?? 'Counter';
            const v = s.varianceCents;
            if (s.status !== 'closed' || v === null) return `${label} not closed`;
            return isPositive(v) ? `${label} over ${money(v)}` : isNegative(v) ? `${label} short ${money(abs(v))}` : `${label} exact`;
          })
          .join(', ');
  return enqueue({
    kind: 'night_summary',
    key: `night:${date}`,
    businessDate: date,
    params: [`${formatWeekday(date)} ${formatIsoDate(date)}`, money(settlement.netSales(date)), String(bills.length), money(by('cash')), money(by('mpesa')), money(by('card')), money(voided), drawerText],
  });
}

/**
 * The morning after: a night that traded but whose drawers were never all closed still gets its
 * summary, once the business day has moved on. Checked whenever the sender runs.
 */
export function catchUpNightSummary(): number {
  const clock = reporting.clock();
  if (clock.current === clock.lastNight) return 0;
  return queueNightSummary(clock.lastNight);
}

on('audit', 'notify', (event) => {
  if (event.action === 'line.voided') onVoid(event);
  else if (event.action === 'bill.refunded') onBill(event, 'A refund');
  else if (event.action === 'bill.voided') onBill(event, 'A voided bill');
  else if (event.action === 'drawer.closed') onDrawerClosed(event);
  else if (event.action === 'trade.cleared') onCleared(event);
});

on('order.fired', 'notify', onFired);
