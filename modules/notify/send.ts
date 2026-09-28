import 'server-only';

import type { NotificationRecord } from '@bliss/db/seed/types';
import { after } from 'next/server';
import { fresh, withWrite } from '../_data/store';
import { TEST_TEMPLATE, whatsappEnv } from './config';
import { notifyTables } from './service';
import { catchUpNightSummary } from './triggers';

/**
 * The WhatsApp sender, docs/20: the WhatsApp Business Platform's Cloud API, from the business
 * number to each recipient, one template message at a time.
 *
 *   1. Due messages are claimed in a write (status sending, with a one minute lease), so two server
 *      instances never send the same one.
 *   2. Each is sent; the answer is written back: sent with WhatsApp's id, or failed with the reason
 *      and a later time to try again (1, 5 and 15 minutes, then hourly), six tries in all. A refusal
 *      that retrying cannot fix (no such template, not a WhatsApp number) stops at once.
 *   3. Delivered and read come back later through the webhook (app/api/whatsapp/webhook).
 *
 * It runs after a response, never in one: a station's sync or a Console action is never slowed.
 */

const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 60 * 60_000];
/** Errors retrying cannot fix: bad parameters, no such template, not a WhatsApp user. */
const PERMANENT = new Set([100, 131008, 131009, 131021, 131026, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016]);

type Outcome = { id: string; ok: true; providerId: string } | { id: string; ok: false; error: string; permanent: boolean };

const state = ((globalThis as unknown as { __blissNotify?: { running: boolean; lastRun: number } }).__blissNotify ??= { running: false, lastRun: 0 });

/**
 * After this response, work through the queue. Safe to call from any route or action. Background
 * callers (a station's pull, the Console's heartbeat) pass `idle`, and run at most every ten seconds;
 * anything a person just did sends at once.
 */
export function kickNotifications(options: { idle?: boolean } = {}): void {
  if (process.env.VITEST) return;
  const run = () => drain({ force: !options.idle });
  try {
    after(run);
  } catch {
    // Outside a request (a script): send now, in the background.
    void run().catch(() => undefined);
  }
}

/** Claim what is due, send it, and write down how it went. At most once every ten seconds per instance unless forced. */
export async function drain(options: { force?: boolean } = {}): Promise<{ sent: number; failed: number }> {
  if (state.running || (!options.force && Date.now() - state.lastRun < 10_000)) return { sent: 0, failed: 0 };
  // A forced run that finds one already going leaves the rest to the next beat; nothing is lost, it stays queued.
  state.running = true;
  state.lastRun = Date.now();
  try {
    await fresh();
    const env = whatsappEnv();
    const claimed = await withWrite(() => {
      catchUpNightSummary();
      if (!env.configured) return [] as NotificationRecord[];
      const now = Date.now();
      const due = notifyTables()
        .notifications.filter((n) => ((n.status === 'queued' || (n.status === 'failed' && n.attempts < MAX_ATTEMPTS)) && n.nextAttemptAt <= now) || (n.status === 'sending' && (n.leaseUntil ?? 0) < now))
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, 20);
      for (const n of due) {
        n.status = 'sending';
        n.leaseUntil = now + 60_000;
        n.updatedAt = now;
      }
      return due.map((n) => ({ ...n, params: [...n.params] }));
    });
    if (claimed.length === 0) return { sent: 0, failed: 0 };
    const outcomes = await Promise.all(claimed.map((n) => sendOne(n, env)));
    await withWrite(() => {
      const now = Date.now();
      const rows = notifyTables().notifications;
      for (const o of outcomes) {
        const n = rows.find((r) => r.id === o.id);
        if (!n) continue;
        n.attempts += 1;
        n.leaseUntil = null;
        n.updatedAt = now;
        if (o.ok) {
          n.status = 'sent';
          n.providerId = o.providerId;
          n.sentAt = now;
          n.lastError = null;
        } else {
          n.status = 'failed';
          n.lastError = o.error.slice(0, 300);
          if (o.permanent) n.attempts = Math.max(n.attempts, MAX_ATTEMPTS);
          n.nextAttemptAt = now + (BACKOFF_MS[Math.min(n.attempts - 1, BACKOFF_MS.length - 1)] ?? 60 * 60_000);
        }
      }
    });
    return { sent: outcomes.filter((o) => o.ok).length, failed: outcomes.filter((o) => !o.ok).length };
  } catch (error) {
    console.error('[notify]', error);
    return { sent: 0, failed: 0 };
  } finally {
    state.running = false;
  }
}

async function sendOne(n: NotificationRecord, env: ReturnType<typeof whatsappEnv>): Promise<Outcome> {
  const test = n.template === TEST_TEMPLATE.name;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: n.to,
    type: 'template',
    template: {
      name: n.template,
      language: { code: test ? TEST_TEMPLATE.language : env.language },
      ...(n.params.length > 0 ? { components: [{ type: 'body', parameters: n.params.map((text) => ({ type: 'text', text })) }] } : {}),
    },
  };
  try {
    const response = await fetch(`${env.base}/${env.version}/${env.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number; error_data?: { details?: string } } };
    const id = json.messages?.[0]?.id;
    if (response.ok && id) return { id: n.id, ok: true, providerId: id };
    const code = json.error?.code ?? response.status;
    const detail = json.error?.error_data?.details ?? json.error?.message ?? `HTTP ${response.status}`;
    return { id: n.id, ok: false, error: `${code}: ${detail}`, permanent: PERMANENT.has(Number(code)) };
  } catch (error) {
    return { id: n.id, ok: false, error: error instanceof Error ? error.message : 'No answer from WhatsApp', permanent: false };
  }
}

/** A delivery status from the webhook: delivered, read, or failed after it was accepted. */
export async function applyStatuses(statuses: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[]): Promise<void> {
  if (statuses.length === 0) return;
  await fresh();
  await withWrite(() => {
    const rows = notifyTables().notifications;
    const rank = { queued: 0, sending: 1, failed: 1, sent: 2, delivered: 3, read: 4 } as const;
    for (const s of statuses) {
      const n = rows.find((r) => r.providerId === s.id);
      if (!n) continue;
      if (s.status === 'failed') {
        n.status = 'failed';
        n.attempts = MAX_ATTEMPTS;
        n.lastError = s.errors?.map((e) => `${e.code ?? ''}: ${e.message ?? e.title ?? 'failed'}`).join('; ').slice(0, 300) ?? 'Failed after sending';
      } else if (s.status === 'delivered' || s.status === 'read' || s.status === 'sent') {
        // Statuses can arrive out of order: never step back from read to delivered.
        if (rank[s.status] > rank[n.status]) n.status = s.status;
      }
      n.updatedAt = Date.now();
    }
  });
}
