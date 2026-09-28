'use client';

import { formatDateTime } from '@bliss/shared/format';
import type { OutletAlert } from '@bliss/shared/domain';
import { Button, IconButton } from '@bliss/ui/components/button';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { Switch, TextField } from '@bliss/ui/components/fields';
import { type Tone, ToneChip } from '@bliss/ui/components/status';
import { IconBellRinging, IconCopy, IconFileText, IconHistory, IconPlugConnected, IconPlus, IconSend, IconTrash, IconUsers } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveNotifySettings, sendTestAlert } from '../../_actions/settings';

type Recipient = { name: string; phone: string; active: boolean; display?: string };
type Template = { kind: OutletAlert; name: string; title: string; when: string; body: string; example: string[] };
type Message = { id: string; kind: string; to: string; preview: string; status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'; attempts: number; error: string | null; at: number; sentAt: number | null };

const STATUS: Record<Message['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'info', label: 'Waiting' },
  sending: { tone: 'info', label: 'Sending' },
  sent: { tone: 'accent', label: 'Sent' },
  delivered: { tone: 'poured', label: 'Delivered' },
  read: { tone: 'poured', label: 'Read' },
  failed: { tone: 'stop', label: 'Failed' },
};

const KIND: Record<string, string> = { night_summary: 'Night summary', drawer_variance: 'Drawer out', void_refund: 'Void or refund', stock_out: 'Item finished', trade_cleared: 'Trade cleared', test: 'Test' };

/** Who gets which alert, a test, the templates to have approved, and the log. */
export function WhatsappView({
  canManage,
  configured,
  webhookUrl,
  timezone,
  settings,
  templates,
  messages,
}: {
  canManage: boolean;
  configured: boolean;
  webhookUrl: string;
  timezone: string;
  settings: { recipients: Recipient[]; alerts: Record<OutletAlert, boolean>; voidAlert: string };
  templates: Template[];
  messages: Message[];
}) {
  const router = useRouter();
  const notify = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>(settings.recipients.map((r) => ({ name: r.name, phone: r.display ?? r.phone, active: r.active })));
  const [alerts, setAlerts] = useState(settings.alerts);
  const [voidAlert, setVoidAlert] = useState(settings.voidAlert);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveNotifySettings({ recipients, alerts, voidAlert });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    notify({ title: 'WhatsApp alerts saved' });
    router.refresh();
  };

  const test = async () => {
    setTesting(true);
    const result = await sendTestAlert({ phone: null });
    setTesting(false);
    if (!result.ok) return notify({ tone: 'stop', title: 'No test sent', body: result.message });
    notify({ title: 'Test on its way', body: configured ? `To ${result.queued} ${result.queued === 1 ? 'number' : 'numbers'}. It shows in the log in a moment.` : 'It waits in the log until the business number is connected.' });
    setTimeout(() => router.refresh(), 2500);
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    notify({ title: 'Copied' });
  };

  return (
    <div className="flex flex-col gap-24">
      {!configured ? (
        <Card aria-labelledby="wa-connect" tone="accent">
          <CardHeader band level="h2" titleId="wa-connect" icon={IconPlugConnected} title="Connect the business number" subtitle="Once, by whoever manages the venue's Meta business account" />
          <CardBody>
            <ol className="measure flex list-decimal flex-col gap-8 pl-20 text-body text-ink-muted">
              <li>In Meta Business Suite, create a WhatsApp Business account and add the number the alerts come from. It cannot be a number already on the WhatsApp app.</li>
              <li>In the Meta developer app for it, make a permanent access token for a system user with the whatsapp_business_messaging permission, and copy the number's Phone number ID.</li>
              <li>
                In WhatsApp Manager, create the five templates below, category Utility, language English, word for word.
              </li>
              <li>
                Set these on the server (Vercel, Settings, Environment Variables), then redeploy: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN (any long phrase you choose) and WHATSAPP_APP_SECRET.
              </li>
              <li>
                In the developer app, under WhatsApp, Configuration, set the webhook to <span className="font-mono text-ink">{webhookUrl}</span> with the same verify token, and subscribe to messages.
              </li>
              <li>Send a test from here. Alerts raised before now are waiting and go out as soon as it connects.</li>
            </ol>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-24 tablet:grid-cols-2">
        <Card aria-labelledby="wa-who">
          <CardHeader band level="h2" titleId="wa-who" icon={IconUsers} title="Who gets them" subtitle="Kenyan mobile numbers on WhatsApp" />
          <CardBody className="flex flex-col gap-12">
            {recipients.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-end gap-12">
                <TextField label="Name" value={r.name} disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <TextField label="WhatsApp number" value={r.phone} inputMode="tel" disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                {canManage ? <IconButton icon={IconTrash} label={`Remove ${r.name || 'this number'}`} variant="ghost" onClick={() => setRecipients((all) => all.filter((_, j) => j !== i))} /> : null}
              </div>
            ))}
            {recipients.length === 0 ? <p className="text-body text-ink-muted">Nobody gets alerts. Add a number.</p> : null}
            {canManage && recipients.length < 10 ? (
              <Button variant="ghost" icon={IconPlus} className="self-start" onClick={() => setRecipients((all) => [...all, { name: '', phone: '', active: true }])}>
                Add a number
              </Button>
            ) : null}
          </CardBody>
        </Card>

        <Card aria-labelledby="wa-which">
          <CardHeader band level="h2" titleId="wa-which" icon={IconBellRinging} title="Which alerts" subtitle="Each goes to every number on the left" />
          <CardBody className="flex flex-col">
            {templates.map((t) => (
              <Switch key={t.kind} label={t.title} helper={t.when} checked={alerts[t.kind]} disabled={!canManage} onChange={(next) => setAlerts((a) => ({ ...a, [t.kind]: next }))} />
            ))}
            <div className="mt-8 max-w-[240px]">
              <TextField label="Voids and refunds from, KES" value={voidAlert} mono inputMode="numeric" disabled={!canManage} onChange={(e) => setVoidAlert(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} helper="Smaller ones are in the audit trail only." />
            </div>
          </CardBody>
        </Card>
      </div>

      {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
      {canManage ? (
        <div className="flex flex-wrap gap-12">
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save alerts
          </Button>
          <Button variant="outline" icon={IconSend} loading={testing} onClick={() => void test()}>
            Send a test
          </Button>
        </div>
      ) : null}

      <Card aria-labelledby="wa-templates">
        <CardHeader band level="h2" titleId="wa-templates" icon={IconFileText} title="Templates to have approved" subtitle="WhatsApp only lets a business start a chat with an approved template. Create each in WhatsApp Manager, word for word." />
        <ul className="flex flex-col">
          {templates.map((t) => (
            <li key={t.kind} className="flex flex-col gap-6 border-t border-edge px-20 py-16 first:border-t-0">
              <div className="flex items-center justify-between gap-12">
                <span className="flex items-baseline gap-12">
                  <span className="text-ui text-ink">{t.title}</span>
                  <span className="font-mono text-body-sm text-ink-subtle">{t.name}</span>
                </span>
                <IconButton icon={IconCopy} label={`Copy the ${t.title} template`} variant="ghost" size="sm" onClick={() => copy(t.body)} />
              </div>
              <p className="measure font-mono text-body-sm text-ink">{t.body}</p>
              <p className="text-body-sm text-ink-subtle">Example for review: {t.example.map((e, i) => `{{${i + 1}}} ${e}`).join(' · ')}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card aria-labelledby="wa-log">
        <CardHeader band level="h2" titleId="wa-log" icon={IconHistory} title="Messages" subtitle="The last forty, newest first" />
        {messages.length === 0 ? (
          <CardBody>
            <p className="text-body text-ink-muted">Nothing yet. Alerts appear here as they are raised, with how far each got.</p>
          </CardBody>
        ) : (
          <ul className="flex flex-col">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-4 border-t border-edge px-20 py-12 first:border-t-0">
                <div className="flex flex-wrap items-center gap-12">
                  <ToneChip tone={STATUS[m.status].tone}>{m.status === 'failed' && m.attempts < 6 ? 'Retrying' : STATUS[m.status].label}</ToneChip>
                  <span className="text-ui text-ink">{KIND[m.kind] ?? m.kind}</span>
                  <span className="font-mono text-body-sm text-ink-subtle">{m.to}</span>
                  <span className="ml-auto font-mono text-body-sm text-ink-subtle">{formatDateTime(m.at, timezone)}</span>
                </div>
                <p className="measure text-body-sm text-ink-muted">{m.preview}</p>
                {m.error ? <p className="text-body-sm text-stop">{m.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
