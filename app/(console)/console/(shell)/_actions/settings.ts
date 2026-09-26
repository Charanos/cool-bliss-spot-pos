'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
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
