'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
import { isUserFacing } from '@/modules/_data/errors';
import { clearTrade } from '@/modules/trade/clear';
import { type ActionResult, id, kes, reason, runAction } from '../_lib/action';
import * as notify from '@/modules/notify/service';
import { kickNotifications } from '@/modules/notify/send';

/** Settings actions: devices, sync conflicts and personal preferences. */

export async function withdrawDevice(raw: { deviceId: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ deviceId: id('device'), reason }), raw, (input, actor) => {
    identity.withdrawDevice({ ...input, actor });
  });
}

export async function resolveDeadLetter(raw: { id: string; reason: string }): Promise<ActionResult> {
  return runAction(z.object({ id: id('change'), reason }), raw, (input, actor) => {
    sync.resolve({ ...input, actor });
  });
}

export type ThemePreference = 'light' | 'dark' | 'system';

/** Remember the Console theme for this browser. A preference, not outlet data: no write, no audit. */
/**
 * Clear trade after a trial run: owners only, with a reason and the word CLEAR typed to confirm.
 * Asynchronous work of its own (it replaces the epoch), so it runs outside runAction's write.
 */
export async function clearTradeAction(raw: { confirm: string; reason: string }): Promise<ActionResult<{ summary: string }>> {
  const actor = await identity.currentConsoleActor();
  if (raw.confirm.trim().toUpperCase() !== 'CLEAR') return { ok: false, message: 'Type CLEAR to confirm.' };
  try {
    const s = await clearTrade({ actor, reason: raw.reason });
    revalidatePath('/console', 'layout');
    kickNotifications();
    return { ok: true, summary: `${s.tabs} tabs, ${s.bills} bills, ${s.shifts} shifts and ${s.drawers} drawers cleared; ${s.stockMovements} stock movements from sales put back.` };
  } catch (error) {
    if (isUserFacing(error)) return { ok: false, message: (error as Error).message };
    console.error('[clear trade]', error);
    return { ok: false, message: 'That did not go through, and nothing was changed. Try again in a moment.' };
  }
}

/** WhatsApp alerts: who gets them, which, and the void amount. docs/20. */
export async function saveNotifySettings(raw: { recipients: { name: string; phone: string; active: boolean }[]; alerts: Record<string, boolean>; voidAlert: string }): Promise<ActionResult> {
  const schema = z.object({
    recipients: z.array(z.object({ name: z.string().max(60), phone: z.string().max(30), active: z.boolean() })).max(10, 'Ten numbers at most.'),
    alerts: z.object({ night_summary: z.boolean(), drawer_variance: z.boolean(), void_refund: z.boolean(), stock_out: z.boolean(), trade_cleared: z.boolean() }),
    voidAlert: kes('the void amount'),
  });
  return runAction(schema, raw, (input, actor) => {
    notify.updateSettings({ recipients: input.recipients, alerts: input.alerts, voidAlertCents: input.voidAlert, actor });
  });
}

/** A test message with WhatsApp's own template, to one number or every active one. */
export async function sendTestAlert(raw: { phone: string | null }): Promise<ActionResult<{ queued: number }>> {
  return runAction(z.object({ phone: z.string().max(30).nullable() }), raw, (input, actor) => ({ queued: notify.queueTest({ phone: input.phone, actor }) }));
}

export async function setTheme(theme: ThemePreference): Promise<void> {
  await identity.currentConsoleActor();
  const value = theme === 'dark' || theme === 'light' ? theme : 'system';
  (await cookies()).set('bliss-console-theme', value, { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/console', 'layout');
}

/** Remember whether the rail is folded. */
export async function setRailCollapsed(collapsed: boolean): Promise<void> {
  await identity.currentConsoleActor();
  (await cookies()).set('bliss-console-rail', collapsed ? 'collapsed' : 'open', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
}
