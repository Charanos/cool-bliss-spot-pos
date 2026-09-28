import { formatFigure } from '@bliss/shared/money';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import * as identity from '@/modules/identity/service';
import { ALERT_ORDER, TEMPLATES, displayPhone, render, whatsappEnv } from '@/modules/notify/config';
import * as notify from '@/modules/notify/service';
import { ViewHeader } from '../../_components/workspace';
import { WhatsappView } from './whatsapp-view';

export const metadata: Metadata = { title: 'WhatsApp' };

/**
 * WhatsApp alerts, docs/20: what arrives and how it reads, whether the business number is connected
 * (each step ticked from the server's own settings), who gets which alerts, the templates to have
 * approved, and every message with how far it got.
 */
export default async function WhatsappPage() {
  const actor = await identity.currentConsoleActor();
  const env = whatsappEnv();
  const s = notify.settings();
  const host = (await headers()).get('host') ?? 'your-site';
  const messages = notify.recent(60);
  const reached = (m: { status: string }) => m.status === 'sent' || m.status === 'delivered' || m.status === 'read';
  const tested = messages.some((m) => m.kind === 'test' && reached(m));
  // A real alert getting through means its template is approved; the test uses WhatsApp's own.
  const approved = messages.some((m) => m.kind !== 'test' && reached(m));
  const receipts = messages.some((m) => m.status === 'delivered' || m.status === 'read');

  return (
    <>
      <ViewHeader page="/console/settings/whatsapp" />
      <WhatsappView
        canManage={identity.can(actor.staffId, 'staff.manage')}
        timezone={identity.outlet().timezone}
        webhookUrl={`https://${host}/api/whatsapp/webhook`}
        setup={{
          connected: env.configured,
          token: Boolean(env.token),
          phoneNumberId: Boolean(env.phoneNumberId),
          webhook: Boolean(env.appSecret && env.verifyToken),
          tested,
          approved,
          receipts,
        }}
        settings={{
          recipients: s.recipients.map((r) => ({ name: r.name, phone: displayPhone(r.phone), active: r.active })),
          alerts: s.alerts,
          voidAlert: formatFigure(s.voidAlertCents, { decimals: 'whole' }).replace(/,/g, ''),
        }}
        templates={ALERT_ORDER.map((k) => {
          const t = TEMPLATES[k];
          const last = messages.find((m) => m.kind === k);
          return { ...t, sample: render(t.body, t.example), last: last ? { text: last.preview, at: last.createdAt } : null };
        })}
        messages={messages.map((m) => ({ id: m.id, kind: m.kind, to: displayPhone(m.to), preview: m.preview, status: m.status, attempts: m.attempts, error: m.lastError, at: m.createdAt }))}
      />
    </>
  );
}
