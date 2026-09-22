import type { BillScope, TenderKind } from '../domain';
import type { Cents } from '../money';
import { type IsoDate, addDays, weekdayOf } from '../time';

/**
 * The night's record, as the Floor and the Counter read it. docs/16 section 9.
 *
 * The shapes the history read model returns (modules/history/service.ts builds them on the server),
 * and the named ranges the history screens offer. Both live here so the server and the devices read
 * one definition.
 */

export type HistoryTabState = 'ordering' | 'seated' | 'cleared' | 'voided' | 'merged';

export interface HistoryLine {
  id: string;
  name: string;
  detail: string | null;
  qty: number;
  seatNo: number | null;
  orderNumber: number | null;
  status: 'pending' | 'served' | 'voided';
  firedAt: number | null;
  servedAt: number | null;
  servedBy: string | null;
  deliveredAt: number | null;
  voidReason: string | null;
  lineTotalCents: Cents;
}

export interface HistoryBill {
  id: string;
  billNumber: number;
  scope: BillScope;
  seatNo: number | null;
  totalCents: Cents;
  settledAt: number | null;
  settledBy: string;
  device: string;
  /** How it was paid. The amounts are null for tonight while the asking device counts blind. */
  tenders: { kind: TenderKind; amountCents: Cents | null }[];
}

export interface HistoryTab {
  id: string;
  businessDate: IsoDate;
  label: string;
  tabNumber: number | null;
  zone: string;
  waiterId: string;
  waiter: string;
  guests: number;
  openedAt: number;
  closedAt: number | null;
  clearedAt: number | null;
  state: HistoryTabState;
  lines: HistoryLine[];
  bills: HistoryBill[];
  totalCents: Cents;
  paidCents: Cents;
}

export interface HistorySale {
  bill: HistoryBill;
  items: { name: string; qty: number; lineTotalCents: Cents }[];
}

export interface HistoryDay {
  businessDate: IsoDate;
  tabs: HistoryTab[];
  sales: HistorySale[];
}

export interface HistorySummary {
  tabs: number;
  guests: number;
  linesFired: number;
  itemsPoured: number;
  voided: number;
  quickSales: number;
  /** Null when withheld for the blind count. */
  takingsCents: Cents | null;
  averageTabCents: Cents | null;
  byTender: { kind: TenderKind; amountCents: Cents }[] | null;
  withheld: boolean;
}

export interface HistoryResult {
  from: IsoDate;
  to: IsoDate;
  currentBusinessDate: IsoDate;
  generatedAt: number;
  days: HistoryDay[];
  summary: HistorySummary;
  truncated: boolean;
}
/* ------------------------------------------------------------------ ranges */

export type HistoryPreset = 'tonight' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';

export const HISTORY_PRESETS: readonly { value: Exclude<HistoryPreset, 'custom'>; label: string }[] = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

/** The longest range a history screen asks for. Reports across more belong in the Console. */
export const HISTORY_MAX_DAYS = 93;

function firstOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/**
 * A named range as business dates, inclusive, counted from tonight's business date. Weeks start on
 * Monday. "Tonight" is the business day in progress, so a night that runs past midnight is still
 * one night.
 */
export function historyRange(preset: Exclude<HistoryPreset, 'custom'>, current: IsoDate): { from: IsoDate; to: IsoDate } {
  switch (preset) {
    case 'tonight':
      return { from: current, to: current };
    case 'yesterday': {
      const y = addDays(current, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: addDays(current, 1 - weekdayOf(current)), to: current };
    case 'last7':
      return { from: addDays(current, -6), to: current };
    case 'month':
      return { from: firstOfMonth(current), to: current };
    case 'lastMonth': {
      const end = addDays(firstOfMonth(current), -1);
      return { from: firstOfMonth(end), to: end };
    }
  }
}

/** Which named range a pair of dates is, if any, so a custom pick that matches one reads as it. */
export function matchPreset(from: IsoDate, to: IsoDate, current: IsoDate): HistoryPreset {
  for (const p of HISTORY_PRESETS) {
    const r = historyRange(p.value, current);
    if (r.from === from && r.to === to) return p.value;
  }
  return 'custom';
}
