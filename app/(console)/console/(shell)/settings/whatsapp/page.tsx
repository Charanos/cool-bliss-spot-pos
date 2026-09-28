import { formatFigure } from '@bliss/shared/money';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { IconAlertTriangle, IconBrandWhatsapp, IconChecks, IconUsers } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import * as identity from '@/modules/identity/service';
import { ALERT_ORDER, TEMPLATES, displayPhone, whatsappEnv } from '@/modules/notify/config';
import * as notify from '@/modules/notify/service';
import { ViewHeader } from '../../_components/workspace';
import { WhatsappView } from './whatsapp-view';

export const metadata: Metadata = { title: 'WhatsApp' };

/**
 * WhatsApp alerts, docs/20: whether the business number is connected, who gets which alerts, the
 * templates to have approved, and every message with how far it got.
 */
export default async function WhatsappPage() {
  const actor = await identity.currentConsoleActor();
  const env = whatsappEnv();
  const s = notify.settings();
  const tz = identity.outlet().timezone;
  const host = (await headers()).get('host') ?? 'your-site';
  const messages = notify.recent(40);
  const since = Date.now() - 24 * 3_600_000;
  const lastDay = messages.filter((m) => m.createdAt >= since);
  const reached = lastDay.filter((m) => m.status === 'delivered' || m.status === 'read').length;
  const stuck = messages.filter((m) => m.status === 'failed' || m.status === 'queued').length;

  return (
    <>
      <ViewHeader page="/console/settings/whatsapp" />
      <div className="flex flex-col gap-32">
        <MetricGrid>
          <Metric label="Business number" icon={IconBrandWhatsapp} tone={env.configured ? 'poured' : 'attention'} value={env.configured ? 'Connected' : 'Not yet'} detail={env.configured ? 'Alerts send as they happen' : 'Alerts wait here until it is'} />
          <Metric label="Numbers" icon={IconUsers} value={s.recipients.filter((r) => r.active).length} detail={s.recipients.length === 0 ? 'Nobody gets alerts' : s.recipients.map((r) => r.name).join(', ')} />
          <Metric label="Reached, last 24 hours" icon={IconChecks} value={reached} detail={`${lastDay.length} sent in all`} />
          <Metric label="Waiting or failed" icon={IconAlertTriangle} tone={stuck > 0 ? 'attention' : undefined} value={stuck} detail={stuck > 0 ? 'See the log below' : 'Nothing held back'} />
        </MetricGrid>
        <WhatsappView
          canManage={identity.can(actor.staffId, 'staff.manage')}
          configured={env.configured}
          webhookUrl={`https://${host}/api/whatsapp/webhook`}
          timezone={tz}
          settings={{
            recipients: s.recipients.map((r) => ({ ...r, display: displayPhone(r.phone) })),
            alerts: s.alerts,
            voidAlert: formatFigure(s.voidAlertCents, { decimals: 'whole' }).replace(/,/g, ''),
          }}
          templates={ALERT_ORDER.map((k) => TEMPLATES[k])}
          messages={messages.map((m) => ({ id: m.id, kind: m.kind, to: displayPhone(m.to), preview: m.preview, status: m.status, attempts: m.attempts, error: m.lastError, at: m.createdAt, sentAt: m.sentAt }))}
        />
      </div>
    </>
  );
}
