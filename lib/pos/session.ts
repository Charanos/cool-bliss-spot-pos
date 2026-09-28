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
  const devices = (await posDb().devices.toArray()).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  // Kept while the venue still lists it. One it no longer knows (a handover, or removed) or withdrew
  // is let go, so this browser pairs again instead of being refused as "not registered".
  const current = stored ? devices.find((d) => d.id === stored.id) : undefined;
  if (stored && (devices.length === 0 || (current && current.status === 'active'))) return stored;
  if (stored) await setMeta(META.deviceId, null);
  const surface = currentSurface();
  // A device still waiting for its code is never taken: it is claimed with that code (claimDevice).
  const first = devices.find((d) => d.kind === surface && d.status === 'active' && !d.pairing);
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

/**
 * Whether this browser still needs pairing before anyone can sign in: it holds no device, or the one it
 * holds the venue no longer lists, withdrew, or is still waiting for its code. Undefined while the
 * first pull has not landed, so the screen does not flash the pairing step on a paired tablet.
 */
export function useNeedsPairing(bootstrapped: boolean): boolean | undefined {
  return useLiveQuery(async () => {
    if (!bootstrapped) return undefined;
    const bound = await getMeta<BoundDevice>(META.deviceId);
    const known = bound ? await posDb().devices.get(bound.id) : null;
    if (known) return known.status !== 'active' || Boolean(known.pairing);
    // Nothing bound, or bound to a device this browser has not heard of: pair, unless ensureDevice
    // has a paired one of this surface to take.
    const surface = currentSurface();
    return !(await posDb().devices.toArray()).some((d) => d.kind === surface && d.status === 'active' && !d.pairing);
  }, [bootstrapped]);
}

/** Pair a new tablet or till with the six-digit code shown in Console, Settings, Devices. */
export async function claimDevice(code: string): Promise<SignInResult> {
  try {
    const { body } = await api.post<{ ok: boolean; message?: string; device?: BoundDevice }>('/api/station/identity', { action: 'claim', kind: currentSurface(), code });
    if (!body.ok || !body.device) return { ok: false, message: body.message ?? 'That code does not match.' };
    // Known here as paired at once; the next pull brings the rest.
    await posDb().devices.put({ id: body.device.id, label: body.device.label, kind: currentSurface(), status: 'active', pairing: false });
    await rebind(body.device);
    return { ok: true };
  } catch {
    return { ok: false, message: 'No connection. Pairing needs the network once.' };
  }
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

/**
 * Arrive from another surface as the person who chose to switch. The ticket names them and works
 * once; whoever was signed in on this device before is replaced by them, so what happens next is
 * recorded against the person standing here. Anything wrong with the ticket leaves the PIN screen.
 */
export async function redeemHandoff(ticket: string, spare: BoundDevice | null = null): Promise<SignInResult> {
  let device = await ensureDevice();
  // A manager or owner opening a station from the Console brings a browser of their own, made for
  // them by the server: used when this browser holds no device the venue still knows.
  if (!device && spare) device = await rebind(spare);
  if (!device) return { ok: false, message: 'This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.' };
  try {
    const first = await api.post<SignInBody>('/api/station/identity', { action: 'continue', deviceId: device.id, ticket });
    if (first.status === 403 && spare && spare.id !== device.id) {
      await rebind(spare);
      return await settle((await api.post<SignInBody>('/api/station/identity', { action: 'continue', deviceId: spare.id, ticket })).body);
    }
    return await settle(first.body);
  } catch {
    return { ok: false, message: 'No connection. Choose your name, then enter your PIN.' };
  }
}

/** Bind this browser to another device, and pull the whole picture again with its id on it. */
async function rebind(device: BoundDevice): Promise<BoundDevice> {
  await setMeta(META.deviceId, device);
  await setMeta(META.tradeCursor, -1);
  wakeSync();
  return device;
}

/**
 * Go to another surface as yourself. The server reads who is asking from this station's own sign-in
 * and answers with where to go: signed straight in, when your role belongs there, or its PIN screen.
 */
export async function switchTo(to: 'floor' | 'counter' | 'console'): Promise<void> {
  const fallback = to === 'console' ? '/console/sign-in' : `/${to}/sign-in`;
  try {
    const { body } = await api.post<{ ok: boolean; url?: string }>('/api/handoff', { from: 'station', to });
    window.location.href = body.url ?? fallback;
  } catch {
    window.location.href = fallback;
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

/**
 * Sign out on this device, which ends the person's shift on the server. Best effort: offline, the
 * shift stays open and a manager ends it in the Console at the time it really ended.
 */
export async function signOut() {
  try {
    const device = await getMeta<BoundDevice>(META.deviceId);
    await api.post('/api/station/identity', { action: 'sign-out', deviceId: device?.id });
  } catch {
    // No connection: signing out here still works; the Console shows the shift as left running.
  }
  await setMeta(META.stationToken, null);
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
