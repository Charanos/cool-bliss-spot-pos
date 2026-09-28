import 'server-only';

import type { AlertKind, NotificationRecord } from '@bliss/db/seed/types';
import type { NotifySettings, OutletAlert } from '@bliss/shared/domain';
import { type Cents, isNegative } from '@bliss/shared/money';
import type { Actor } from '@bliss/shared/reason';
import { createUuidV7 } from '@bliss/shared/id';
import { DomainError } from '../_data/errors';
import { dataset } from '../_data/source';
import * as audit from '../audit/service';
import * as identity from '../identity/service';
import { ALERT_ORDER, DEFAULT_SETTINGS, TEMPLATES, TEST_TEMPLATE, cleanParam, normalisePhone, render } from './config';

const nextId = createUuidV7();

export const notifyTables = () => ({ notifications: dataset().notifications });

/** Who gets alerts and which, as set in the Console, or the defaults until it is. */
export function settings(): NotifySettings {
  const saved = identity.outlet().notify;
  if (!saved) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...saved, alerts: { ...DEFAULT_SETTINGS.alerts, ...saved.alerts } };
}

/**
 * Queue an alert for every active recipient, inside the write that caused it. One message per key
 * and number: the same night, drawer or item never alerts twice, whoever raised it.
 */
export function enqueue(input: { kind: OutletAlert; key: string; params: string[]; businessDate?: string | null }): number {
  const s = settings();
  if (!s.alerts[input.kind]) return 0;
  return queue({ kind: input.kind, key: input.key, template: TEMPLATES[input.kind].name, params: input.params.map(cleanParam), preview: render(TEMPLATES[input.kind].body, input.params.map(cleanParam)), businessDate: input.businessDate ?? null });
}

function queue(input: { kind: AlertKind; key: string; template: string; params: string[]; preview: string; businessDate: string | null; to?: string[] }): number {
  const { notifications } = notifyTables();
  const outlet = identity.outlet();
  const to = input.to ?? settings().recipients.filter((r) => r.active).map((r) => r.phone);
  const now = Date.now();
  let added = 0;
  for (const phone of new Set(to)) {
    if (notifications.some((n) => n.dedupeKey === input.key && n.to === phone)) continue;
    notifications.push({
      id: nextId(),
      outletId: outlet.id,
      kind: input.kind,
      dedupeKey: input.key,
      to: phone,
      template: input.template,
      params: input.params,
      preview: input.preview,
      businessDate: input.businessDate,
      createdAt: now,
      status: 'queued',
      attempts: 0,
      nextAttemptAt: now,
      leaseUntil: null,
      lastError: null,
      providerId: null,
      sentAt: null,
      updatedAt: now,
    });
    added += 1;
  }
  return added;
}

/** A test to one number, or every active one, with WhatsApp's own template. */
export function queueTest(input: { phone: string | null; actor: Actor }): number {
  identity.assertCan(input.actor.staffId, 'staff.manage', 'sending a test alert');
  const to = input.phone ? [normalisePhone(input.phone)] : settings().recipients.filter((r) => r.active).map((r) => r.phone);
  if (to.some((p) => !p) || to.length === 0) throw new DomainError('Add a number to send the test to.');
  return queue({ kind: 'test', key: `test:${Date.now()}`, template: TEST_TEMPLATE.name, params: [], preview: 'WhatsApp test message (hello world), to check the connection.', businessDate: null, to: to as string[] });
}

/** The most recent messages, newest first. */
export function recent(limit = 50): NotificationRecord[] {
  return [...notifyTables().notifications].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export interface SettingsInput {
  recipients: { name: string; phone: string; active: boolean }[];
  alerts: Record<OutletAlert, boolean>;
  voidAlertCents: Cents;
}

/** Save who gets alerts and which. Owners and managers with settings access; audited. */
export function updateSettings(input: SettingsInput & { actor: Actor }): void {
  identity.assertCan(input.actor.staffId, 'staff.manage', 'changing WhatsApp alerts');
  if (input.recipients.length > 10) throw new DomainError('Ten numbers at most.');
  const recipients = input.recipients.map((r, i) => {
    const phone = normalisePhone(r.phone);
    if (!phone) throw new DomainError(`Number ${i + 1} is not a Kenyan mobile number. Write it as 07.. or 01.., or with 254.`);
    const name = r.name.trim().slice(0, 40) || `Number ${i + 1}`;
    return { name, phone, active: r.active };
  });
  if (new Set(recipients.map((r) => r.phone)).size !== recipients.length) throw new DomainError('The same number is listed twice.');
  if (isNegative(input.voidAlertCents)) throw new DomainError('The void amount cannot be below zero.');
  const alerts = Object.fromEntries(ALERT_ORDER.map((k) => [k, Boolean(input.alerts[k])])) as Record<OutletAlert, boolean>;
  const outlet = identity.outlet();
  const before = settings();
  outlet.notify = { recipients, alerts, voidAlertCents: input.voidAlertCents };
  audit.record({
    outletId: outlet.id,
    actorStaffId: input.actor.staffId,
    actorDeviceId: input.actor.deviceId ?? null,
    action: 'outlet.notify_changed',
    entityType: 'outlet',
    entityId: outlet.id,
    before: { recipients: before.recipients.length, alerts: before.alerts, voidAlertCents: before.voidAlertCents.toString() },
    after: { recipients: recipients.length, alerts, voidAlertCents: input.voidAlertCents.toString() },
    reason: null,
    severity: 'notable',
  });
}
