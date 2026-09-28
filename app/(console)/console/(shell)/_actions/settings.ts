'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
import { isUserFacing } from '@/modules/_data/errors';
import { clearTrade } from '@/modules/trade/clear';
import { type ActionResult, id, reason, runAction } from '../_lib/action';

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
    return { ok: true, summary: `${s.tabs} tabs, ${s.bills} bills, ${s.shifts} shifts and ${s.drawers} drawers cleared; ${s.stockMovements} stock movements from sales put back.` };
  } catch (error) {
    if (isUserFacing(error)) return { ok: false, message: (error as Error).message };
    console.error('[clear trade]', error);
    return { ok: false, message: 'That did not go through, and nothing was changed. Try again in a moment.' };
  }
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
