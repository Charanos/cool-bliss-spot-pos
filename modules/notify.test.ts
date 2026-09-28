import { shillings } from '@bliss/shared/money';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerActor } from '../test/actors';
import * as reporting from './reporting/service';
import { DEFAULT_SETTINGS, cleanParam, normalisePhone } from './notify/config';
import { applyStatuses, drain } from './notify/send';
import { enqueue, notifyTables, queueTest, settings, updateSettings } from './notify/service';
import { queueNightSummary } from './notify/triggers';
import * as audit from './audit/service';
import { compare } from '@bliss/shared/money';
import { tradeTables } from './trade/schema';

/** WhatsApp alerts, docs/20: queued in the write that raised them, once per key and number, sent with retries. */
describe('WhatsApp alerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads Kenyan numbers however they are written', () => {
    expect(normalisePhone('254 0140 490 464')).toBe('254140490464');
    expect(normalisePhone('0118 933 850')).toBe('254118933850');
    expect(normalisePhone('+254 118 933 850')).toBe('254118933850');
    expect(normalisePhone('0712345678')).toBe('254712345678');
    expect(normalisePhone('12345')).toBeNull();
    expect(DEFAULT_SETTINGS.recipients.map((r) => r.phone)).toEqual(['254140490464', '254118933850']);
  });

  it('cleans what WhatsApp refuses in a parameter', () => {
    expect(cleanParam('Wrong\nbottle   opened\tfor them')).toBe('Wrong bottle opened for them');
    expect(cleanParam('   ')).toBe('-');
  });

  it('queues a night summary once per number, however often it is asked', () => {
    const night = reporting.clock().lastNight;
    const first = queueNightSummary(night);
    expect(first).toBe(settings().recipients.filter((r) => r.active).length);
    expect(queueNightSummary(night)).toBe(0);
    const row = notifyTables().notifications.find((n) => n.dedupeKey === `night:${night}`)!;
    expect(row.template).toBe('bliss_night_summary');
    expect(row.params).toHaveLength(8);
    expect(row.preview).toMatch(/^Cool Bliss summary for /);
  });

  it('sends nothing for an alert switched off, and saves who gets them', () => {
    const actor = ownerActor();
    updateSettings({ recipients: [{ name: 'Owner', phone: '0140 490 464', active: true }], alerts: { ...DEFAULT_SETTINGS.alerts, stock_out: false }, voidAlertCents: shillings(2000), actor });
    expect(settings().recipients).toEqual([{ name: 'Owner', phone: '254140490464', active: true }]);
    expect(enqueue({ kind: 'stock_out', key: 'stock:test', params: ['Tusker', '21:00'] })).toBe(0);
    expect(() => updateSettings({ recipients: [{ name: 'Bad', phone: '123', active: true }], alerts: DEFAULT_SETTINGS.alerts, voidAlertCents: shillings(1), actor })).toThrow(/Kenyan/);
    updateSettings({ ...DEFAULT_SETTINGS, actor });
  });

  it('sends with the Cloud API, retries a failure later, and stops on one retrying cannot fix', async () => {
    vi.stubEnv('WHATSAPP_TOKEN', 'test-token');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '1234567890');
    const calls: { url: string; body: { to: string; template: { name: string } } }[] = [];
    let mode: 'ok' | 'down' | 'no-template' = 'ok';
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (mode === 'down') return new Response(JSON.stringify({ error: { code: 1, message: 'Service unavailable' } }), { status: 503 });
      if (mode === 'no-template') return new Response(JSON.stringify({ error: { code: 132001, message: 'Template name does not exist' } }), { status: 404 });
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
    });

    const actor = ownerActor();
    queueTest({ phone: '0118 933 850', actor });
    await drain({ force: true });
    const sent = notifyTables().notifications.find((n) => n.kind === 'test' && n.to === '254118933850')!;
    expect(sent.status).toBe('sent');
    expect(calls.at(-1)!.url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect(calls.at(-1)!.body.template.name).toBe('hello_world');

    await applyStatuses([{ id: sent.providerId!, status: 'read' }]);
    await applyStatuses([{ id: sent.providerId!, status: 'delivered' }]);
    expect(sent.status).toBe('read');

    mode = 'down';
    enqueue({ kind: 'trade_cleared', key: 'cleared:retry', params: ['Dan', '09:00', '1 tab', 'Trial run'] });
    await drain({ force: true });
    const retry = notifyTables().notifications.filter((n) => n.dedupeKey === 'cleared:retry');
    expect(retry.every((n) => n.status === 'failed' && n.attempts === 1 && n.nextAttemptAt > Date.now())).toBe(true);

    mode = 'no-template';
    enqueue({ kind: 'trade_cleared', key: 'cleared:permanent', params: ['Dan', '09:00', '1 tab', 'Trial run'] });
    await drain({ force: true });
    const stopped = notifyTables().notifications.filter((n) => n.dedupeKey === 'cleared:permanent');
    expect(stopped.every((n) => n.status === 'failed' && n.attempts >= 6 && /132001/.test(n.lastError ?? ''))).toBe(true);
  });

  it('queues a void above the amount, raised through the audit trail, and ignores one below it', () => {
    const lines = tradeTables().lines;
    const big = lines.find((l) => compare(l.lineTotalCents, settings().voidAlertCents) >= 0)!;
    const small = lines.find((l) => compare(l.lineTotalCents, settings().voidAlertCents) < 0)!;
    const actor = ownerActor();
    for (const line of [big, small]) {
      audit.record({ outletId: line.outletId, actorStaffId: actor.staffId, action: 'line.voided', entityType: 'order_line', entityId: line.id, before: null, after: null, reason: 'Poured the wrong bottle for the guest', severity: 'sensitive' });
    }
    expect(notifyTables().notifications.some((n) => n.dedupeKey === `void:${big.id}` && n.template === 'bliss_void_refund')).toBe(true);
    expect(notifyTables().notifications.some((n) => n.dedupeKey === `void:${small.id}`)).toBe(false);
  });
});
