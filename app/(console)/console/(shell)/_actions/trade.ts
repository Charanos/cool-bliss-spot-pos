'use server';

import { zonedInstant } from '@bliss/shared/time';
import { z } from 'zod';
import * as identity from '@/modules/identity/service';
import * as corrections from '@/modules/settlement/corrections';
import * as tabs from '@/modules/trade/console';
import { type ActionResult, id, optionalText, reason, requestId, runAction } from '../_lib/action';

/** Trade corrections from the Console: bills, tabs, drawers and shifts. */

const TRADE = ['/console/trade', '/console/overview', '/console/reports', '/console/inventory'];

export async function voidBill(raw: { billId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ billId: id('bill'), reason }), raw, (input, actor) => corrections.voidBill({ ...input, actor }), { revalidate: TRADE });
}

export async function refundBill(raw: {
  billId: string;
  billLineIds: string[];
  method: 'cash' | 'mpesa' | 'card';
  drawerSessionId: string | null;
  reference: string | null;
  restock: boolean;
  reason: string;
  requestId?: string | null;
}): Promise<ActionResult<{ refundedCents: string }>> {
  const schema = z.object({
    billId: id('bill'),
    billLineIds: z.array(id('line')).min(1, 'Choose at least one line to refund.').max(200),
    method: z.enum(['cash', 'mpesa', 'card'], { error: 'Choose how the money goes back.' }),
    drawerSessionId: id('drawer').nullable(),
    reference: optionalText(40, 'The reference'),
    restock: z.boolean(),
    reason,
    requestId,
  });
  return runAction(schema, raw, (input, actor) => ({ refundedCents: corrections.refundBill({ ...input, requestId: input.requestId ?? null, actor }).refundedCents.toString() }), { revalidate: TRADE });
}

export async function voidTabLine(raw: { lineId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ lineId: id('line'), reason }), raw, (input, actor) => tabs.voidLine({ ...input, actor }), { revalidate: TRADE });
}

export async function moveTab(raw: { tabId: string; toTableId: string }): Promise<ActionResult> {
  return runAction(z.object({ tabId: id('tab'), toTableId: id('table') }), raw, (input, actor) => tabs.moveTab({ ...input, actor }), { revalidate: TRADE });
}

export async function handOverTabs(raw: { tabIds: string[]; toStaffId: string }): Promise<ActionResult> {
  return runAction(z.object({ tabIds: z.array(id('tab')).min(1).max(100), toStaffId: id('person') }), raw, (input, actor) => tabs.handOver({ ...input, actor }), { revalidate: TRADE });
}

export async function forceCloseTab(raw: { tabId: string; reason: string }): Promise<ActionResult<{ voided: number }>> {
  return runAction(z.object({ tabId: id('tab'), reason }), raw, (input, actor) => tabs.forceCloseTab({ ...input, actor }), { revalidate: TRADE });
}

export async function acknowledgeDrawer(raw: { sessionId: string; note: string }): Promise<ActionResult> {
  return runAction(z.object({ sessionId: id('drawer'), note: reason }), raw, (input, actor) => corrections.acknowledgeDrawer({ ...input, actor }), { revalidate: TRADE });
}

export async function closeShift(raw: { shiftId: string; endedAt: string; reason: string }): Promise<ActionResult> {
  const schema = z.object({ shiftId: id('shift'), endedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter when the shift ended.'), reason });
  return runAction(
    schema,
    raw,
    (input, actor) => {
      const [day, hhmm] = input.endedAt.split('T') as [string, string];
      const at = zonedInstant(day, (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000, identity.outlet().timezone);
      tabs.closeShift({ shiftId: input.shiftId, endedAt: at, reason: input.reason, actor });
    },
    { revalidate: TRADE },
  );
}
