'use client';

import { fromWire, toWire } from '@/lib/wire';
import { META, getMeta, setMeta } from './db';

/** The server no longer accepts this device's sign-in. The person signs in again; nothing is lost. */
export class SignInRequired extends Error {
  constructor(message = 'Sign in again on this device.') {
    super(message);
    this.name = 'SignInRequired';
  }
}

/** The last station token read from this device, kept in memory for synchronous uses (printing). */
let cachedToken: string | null = null;

/** The station token rides on every request as a header, never in the body. */
async function stationHeaders(): Promise<Record<string, string>> {
  try {
    cachedToken = (await getMeta<string>(META.stationToken)) ?? null;
    return cachedToken ? { 'x-bliss-station': cachedToken } : {};
  } catch {
    return {};
  }
}

/**
 * The address of a print page for this device. A print window opens synchronously from a tap (or the
 * browser blocks it), and carries no headers, so the station token rides in the address.
 */
export function printUrl(path: string): string {
  return cachedToken ? `${path}?t=${encodeURIComponent(cachedToken)}` : path;
}

/** Load the token into memory once a device starts, so the first print works before any request. */
export async function primeStationToken(): Promise<void> {
  await stationHeaders();
}

/** A sign-in the server refused ends the session on this device, so the PIN screen appears. */
async function endSession() {
  cachedToken = null;
  await setMeta(META.session, null);
  await setMeta(META.stationToken, null);
}

export class NetworkUnavailable extends Error {
  constructor() {
    super('No connection. Orders are saved on this device and will send when it returns.');
  }
}

let forcedOffline = false;

/** The development panel can take this tablet offline without touching the Wi-Fi. */
export function setForcedOffline(value: boolean) {
  forcedOffline = value;
}

export function isForcedOffline() {
  return forcedOffline;
}

/**
 * How long a request may take before this device treats the network as gone. Venue Wi-Fi that is
 * connected with no way out does not fail a request, it holds it, for a minute or more on iPad; the
 * sync cycle waited behind it, and the tablet said neither synced nor offline. A read is small; a
 * push can carry a night's held orders, so it gets longer. A push cut off here that did land is
 * harmless: the server acknowledges an entry it already applied without applying it again.
 */
const TIMEOUT_MS = { GET: 12_000, POST: 25_000 } as const;

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ status: number; body: T }> {
  if (forcedOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) throw new NetworkUnavailable();
  const { json, ...rest } = init;
  let response: Response;
  let text: string;
  // AbortSignal.timeout() is Safari 16; the iPad mini runs 15.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), rest.method === 'POST' ? TIMEOUT_MS.POST : TIMEOUT_MS.GET);
  try {
    response = await fetch(path, {
      ...rest,
      body: json === undefined ? rest.body : toWire(json),
      headers: { 'content-type': 'application/json', ...(await stationHeaders()), ...rest.headers },
      cache: 'no-store',
      signal: controller.signal,
    });
    // The body is read under the same deadline: a reply that stalls halfway is no reply.
    text = await response.text();
  } catch {
    throw new NetworkUnavailable();
  } finally {
    clearTimeout(timer);
  }
  if (response.status >= 500 || response.status === 404) throw new NetworkUnavailable();
  let body: T;
  try {
    body = text ? fromWire<T>(text) : (undefined as T);
  } catch {
    throw new NetworkUnavailable();
  }
  if (response.status === 401 && (body as { code?: string } | undefined)?.code === 'SIGN_IN_REQUIRED') {
    await endSession();
    throw new SignInRequired((body as { message?: string }).message);
  }
  return { status: response.status, body };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json: unknown) => request<T>(path, { method: 'POST', json }),
};
