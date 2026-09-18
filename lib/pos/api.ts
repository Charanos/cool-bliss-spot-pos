'use client';

import { fromWire, toWire } from '@/lib/wire';

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

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ status: number; body: T }> {
  if (forcedOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) throw new NetworkUnavailable();
  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      body: json === undefined ? rest.body : toWire(json),
      headers: { 'content-type': 'application/json', ...rest.headers },
      cache: 'no-store',
    });
  } catch {
    throw new NetworkUnavailable();
  }
  if (response.status >= 500) throw new NetworkUnavailable();
  const text = await response.text();
  return { status: response.status, body: text ? fromWire<T>(text) : (undefined as T) };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json: unknown) => request<T>(path, { method: 'POST', json }),
};
