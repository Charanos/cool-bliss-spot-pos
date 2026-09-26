'use client';

import type { PermissionKey, RoleKey } from '@bliss/shared/domain';
import { useLiveQuery } from 'dexie-react-hooks';
import { api } from './api';
import { wakeSync } from './sync';
import { META, currentSurface, getMeta, posDb, setMeta } from './db';

export interface StaffSession {
  staffId: string;
  displayName: string;
  roleKey: RoleKey;
  permissions: PermissionKey[];
  signedInAt: number;
}

export interface BoundDevice {
  id: string;
  label: string;
}

/**
 * PIN plus device binding. A PIN alone is worthless without a registered device. docs/02 section 8.
 * Enrolment is a manager task in the Console; in development this device binds to the first active
 * device of its own surface: Floor 1 on the floor, Counter 1 at the counter.
 */
export async function ensureDevice(): Promise<BoundDevice | null> {
  const stored = await getMeta<BoundDevice>(META.deviceId);
  if (stored) return stored;
  const devices = (await posDb().devices.toArray()).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  const surface = currentSurface();
  const first = devices.find((d) => d.kind === surface && d.status === 'active');
  if (!first) return null;
  const bound = { id: first.id, label: first.label };
  await setMeta(META.deviceId, bound);
  // The first pull ran before this device knew who it was, so it carried nothing that belongs to a
  // device: its open drawer, its bills today. Rewind the cursor and pull the whole picture again,
  // now with the id on it.
  await setMeta(META.tradeCursor, -1);
  wakeSync();
  return bound;
}

export async function bindDevice(device: BoundDevice) {
  await setMeta(META.deviceId, device);
}

export async function unbindDevice() {
  await setMeta(META.deviceId, null);
}

export function useDevice(): BoundDevice | null | undefined {
  return useLiveQuery(async () => (await getMeta<BoundDevice>(META.deviceId)) ?? null, []);
}

export function useSession(): StaffSession | null | undefined {
  return useLiveQuery(async () => (await getMeta<StaffSession>(META.session)) ?? null, []);
}

export type SignInResult = { ok: true } | { ok: false; message: string; pairing?: boolean; change?: { token: string; length: number }; restart?: boolean };

interface SignInBody {
  ok: boolean;
  code?: string;
  message?: string;
  staff?: { id: string; displayName: string; roleKey: StaffSession['roleKey']; permissions: StaffSession['permissions'] };
  signedInAt?: number;
  token?: string;
  length?: number;
}

export async function signIn(staffId: string, pin: string): Promise<SignInResult> {
  const device = await ensureDevice();
  if (!device) return { ok: false, message: 'This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.' };
  try {
    const { body } = await api.post<SignInBody>('/api/station/identity', {
      action: 'sign-in',
      deviceId: device.id,
      staffId,
      pin,
    });
    return await settle(body);
  } catch {
    return { ok: false, message: 'No connection. Signing in needs the network once; orders already on this tablet are safe.' };
  }
}

/** After a reset or an expiry: choose a new PIN with the pass the sign-in gave, and sign in with it. */
export async function choosePin(token: string, pin: string): Promise<SignInResult> {
  const device = await ensureDevice();
  if (!device) return { ok: false, message: 'This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.' };
  try {
    const { body } = await api.post<SignInBody>('/api/station/identity', { action: 'choose-pin', deviceId: device.id, token, pin });
    return await settle(body);
  } catch {
    return { ok: false, message: 'No connection. Choosing a PIN needs the network.' };
  }
}

async function settle(body: SignInBody): Promise<SignInResult> {
  if (body.code === 'PAIRING_REQUIRED') return { ok: false, message: body.message ?? 'This device needs pairing first.', pairing: true };
  if (body.code === 'PIN_CHANGE_REQUIRED' && body.token) return { ok: false, message: body.message ?? 'Choose a new PIN.', change: { token: body.token, length: body.length ?? 6 } };
  if (body.code === 'PIN_CHANGE_EXPIRED') return { ok: false, message: body.message ?? 'Sign in again.', restart: true };
  if (!body.ok || !body.staff || !body.token) return { ok: false, message: body.message ?? 'That PIN was not recognised.' };
  await setMeta(META.stationToken, body.token);
  const session: StaffSession = {
    staffId: body.staff.id,
    displayName: body.staff.displayName,
    roleKey: body.staff.roleKey,
    permissions: body.staff.permissions,
    signedInAt: body.signedInAt ?? Date.now(),
  };
  await setMeta(META.session, session);
  // The first pull after a sign-in carries this device's trade, which needs the token.
  wakeSync();
  return { ok: true };
}

/** Pair this device with the six-digit code shown in the Console when it was registered. */
export async function pairDevice(code: string): Promise<SignInResult> {
  const device = await ensureDevice();
  if (!device) return { ok: false, message: 'This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.' };
  try {
    const { body } = await api.post<{ ok: boolean; message?: string }>('/api/station/identity', { action: 'pair', deviceId: device.id, code });
    return body.ok ? { ok: true } : { ok: false, message: body.message ?? 'That code does not match.', pairing: true };
  } catch {
    return { ok: false, message: 'No connection. Pairing needs the network once.', pairing: true };
  }
}

export async function signOut() {
  await setMeta(META.session, null);
}

export type ApprovalResult = { ok: true; token: string; approverName: string } | { ok: false; message: string };

/** A supervisor approves inside the dialog with their own PIN. There is no shared password. */
export async function requestApproval(pin: string, permission: 'void.approve' | 'discount.approve' | 'hold.set'): Promise<ApprovalResult> {
  const device = await ensureDevice();
  try {
    const { body } = await api.post<{ ok: boolean; message?: string; token?: string; approverName?: string }>('/api/station/identity', {
      action: 'approve',
      deviceId: device?.id,
      pin,
      permission,
    });
    if (!body.ok || !body.token) return { ok: false, message: body.message ?? 'That PIN cannot approve this.' };
    return { ok: true, token: body.token, approverName: body.approverName ?? '' };
  } catch {
    return { ok: false, message: 'Approval needs a connection. The line stays as it is until then.' };
  }
}
