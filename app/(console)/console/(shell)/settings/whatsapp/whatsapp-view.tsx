'use client';

import { formatDateTime, formatTime } from '@bliss/shared/format';
import type { OutletAlert } from '@bliss/shared/domain';
import { BlissMark } from '@bliss/ui/components/brand';
import { Button, IconButton } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { Switch, TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { type Tone, ToneChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconCash,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconCopy,
  IconEraser,
  IconFileText,
  IconHistory,
  IconMoon,
  IconPackageOff,
  IconPlus,
  IconReceiptRefund,
  IconSend,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { saveNotifySettings, sendTestAlert } from '../../_actions/settings';

type Recipient = { name: string; phone: string; active: boolean };
type Template = { kind: OutletAlert; name: string; title: string; when: string; body: string; example: string[]; sample: string; last: { text: string; at: number } | null };
type Message = { id: string; kind: string; to: string; preview: string; status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'; attempts: number; error: string | null; at: number };
type Setup = { connected: boolean; token: boolean; phoneNumberId: boolean; webhook: boolean; tested: boolean; approved: boolean; receipts: boolean };

const ALERT_ICON: Record<OutletAlert, TablerIcon> = { night_summary: IconMoon, drawer_variance: IconCash, void_refund: IconReceiptRefund, stock_out: IconPackageOff, trade_cleared: IconEraser };
const KIND: Record<string, string> = { night_summary: 'Night summary', drawer_variance: 'Drawer out', void_refund: 'Void or refund', stock_out: 'Item finished', trade_cleared: 'Trade cleared', test: 'Test' };
const STATUS: Record<Message['status'], { tone: Tone; label: string }> = {
  queued: { tone: 'info', label: 'Waiting' },
  sending: { tone: 'info', label: 'Sending' },
  sent: { tone: 'accent', label: 'Sent' },
  delivered: { tone: 'poured', label: 'Delivered' },
  read: { tone: 'poured', label: 'Read' },
  failed: { tone: 'stop', label: 'Failed' },
};

/**
 * WhatsApp alerts, redesigned around the message itself: what arrives on the phone, the few steps
 * that connect the business number (ticked from the server's own settings), which alerts go to
 * whom, and what happened to each message.
 */
export function WhatsappView({
  canManage,
  timezone,
  webhookUrl,
  setup,
  settings,
  templates,
  messages,
}: {
  canManage: boolean;
  timezone: string;
  webhookUrl: string;
  setup: Setup;
  settings: { recipients: Recipient[]; alerts: Record<OutletAlert, boolean>; voidAlert: string };
  templates: Template[];
  messages: Message[];
}) {
  const router = useRouter();
  const notify = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>(settings.recipients);
  const [alerts, setAlerts] = useState(settings.alerts);
  const [voidAlert, setVoidAlert] = useState(settings.voidAlert);
  const [preview, setPreview] = useState<OutletAlert>('night_summary');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed' | 'waiting'>('all');
  const [openTemplate, setOpenTemplate] = useState<OutletAlert | null>(null);

  const dirty = useMemo(() => JSON.stringify({ recipients, alerts, voidAlert }) !== JSON.stringify({ recipients: settings.recipients, alerts: settings.alerts, voidAlert: settings.voidAlert }), [recipients, alerts, voidAlert, settings]);
  const shown = templates.find((t) => t.kind === preview)!;
  const active = recipients.filter((r) => r.active && r.phone.trim());

  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    notify({ title: `${what} copied` });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await saveNotifySettings({ recipients, alerts, voidAlert });
    setSaving(false);
    if (!result.ok) return setError(result.message);
    notify({ title: 'WhatsApp alerts saved' });
    router.refresh();
  };

  const discard = () => {
    setRecipients(settings.recipients);
    setAlerts(settings.alerts);
    setVoidAlert(settings.voidAlert);
    setError(null);
  };

  const test = async () => {
    setTesting(true);
    const result = await sendTestAlert({ phone: null });
    setTesting(false);
    if (!result.ok) return notify({ tone: 'stop', title: 'No test sent', body: result.message });
    notify({ title: 'Test on its way', body: setup.connected ? `To ${result.queued} ${result.queued === 1 ? 'number' : 'numbers'}. Watch the log.` : 'It waits in the log until the number is connected.' });
    setTimeout(() => router.refresh(), 2500);
  };

  const steps: { done: boolean; title: string; body: React.ReactNode }[] = [
    { done: setup.token && setup.phoneNumberId, title: 'Connect the business number', body: <>In Meta, add the number alerts come from to a WhatsApp Business account, make a permanent token, and set <Code>WHATSAPP_TOKEN</Code> and <Code>WHATSAPP_PHONE_NUMBER_ID</Code> on the server. It cannot be a number already on the WhatsApp app.</> },
    { done: setup.tested, title: 'Send a test', body: <>WhatsApp&rsquo;s own hello message, so it works before your templates are approved.</> },
    { done: setup.approved, title: 'Have the templates approved', body: <>Create the five below in WhatsApp Manager, category Utility, English, word for word. Approval usually takes minutes.</> },
    {
      done: setup.webhook && setup.receipts,
      title: 'Hear back when it is read',
      body: (
        <>
          Set <Code>WHATSAPP_APP_SECRET</Code> and <Code>WHATSAPP_VERIFY_TOKEN</Code>, then point the app&rsquo;s webhook at{' '}
          <button type="button" onClick={() => copy(webhookUrl, 'Webhook address')} className="inline-flex items-center gap-4 font-mono text-ink underline decoration-edge-strong underline-offset-4 hover:decoration-accent">
            {webhookUrl}
            <IconCopy size={14} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
          .
        </>
      ),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  const log = messages.filter((m) => (filter === 'failed' ? m.status === 'failed' : filter === 'waiting' ? m.status === 'queued' || m.status === 'sending' : true));

  return (
    <div className="flex flex-col gap-32 pb-72">
      {/* ── What arrives, and how far the connection has got ───────────── */}
      <section aria-label="Connection" className="grid grid-cols-1 items-stretch gap-24 tablet:grid-cols-[minmax(0,1fr)_340px]">
        <Card aria-labelledby="wa-setup">
          <div className="flex flex-wrap items-center gap-16 border-b border-edge px-24 py-20">
            <span className={cx('flex size-control-lg items-center justify-center rounded-control', setup.connected ? 'bg-poured-wash text-poured' : 'bg-low-wash text-low')}>
              {setup.connected ? <IconChecks size={22} stroke={ICON_STROKE} aria-hidden="true" /> : <IconSend size={22} stroke={ICON_STROKE} aria-hidden="true" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 id="wa-setup" className="text-title-section text-ink">
                {setup.connected ? 'Alerts are going out' : 'Alerts are ready, waiting for the number'}
              </h2>
              <p className="text-body-sm text-ink-muted">
                {setup.connected ? `To ${active.length} ${active.length === 1 ? 'number' : 'numbers'}, as they happen.` : 'Everything raised until then is kept and sent once it connects.'}
              </p>
            </div>
            <span className="font-mono tabular text-num-md text-ink-subtle">
              {done} of {steps.length}
            </span>
            {canManage ? (
              <Button variant="outline" icon={IconSend} loading={testing} onClick={() => void test()}>
                Send a test
              </Button>
            ) : null}
          </div>
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-16 border-t border-edge px-24 py-16 first:border-t-0">
                <span aria-hidden="true" className={cx('flex size-[28px] shrink-0 items-center justify-center rounded-pill font-mono text-num-sm', s.done ? 'bg-poured text-page' : 'border border-edge-strong text-ink-subtle')}>
                  {s.done ? <IconCheck size={16} stroke={2} /> : i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-4">
                  <p className={cx('text-ui', s.done ? 'text-ink-muted line-through decoration-edge-strong' : 'text-ink')}>
                    <span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span>
                    {s.title}
                  </p>
                  {s.done ? null : <p className="measure text-body-sm text-ink-muted">{s.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* The phone: the chosen alert as it reads on arrival. */}
        <figure aria-label={`${shown.title}, as it arrives`} className="flex flex-col gap-12">
          <div className="mx-auto flex w-full max-w-[340px] flex-1 flex-col overflow-hidden rounded-sheet border border-edge-strong bg-page shadow-popover">
            <div className="flex items-center gap-12 border-b border-edge px-16 py-12">
              <BlissMark size={32} surface="light" />
              <div className="flex min-w-0 flex-col">
                <span className="text-ui text-ink">Cool Bliss</span>
                <span className="text-micro text-ink-subtle">Business account</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-8 bg-band px-12 py-16">
              <span className="mx-auto rounded-pill bg-card px-12 py-2 text-micro text-ink-subtle shadow-chip">Today</span>
              <p className="max-w-[92%] rounded-lg rounded-tl-sm bg-card px-12 py-8 text-body-sm text-ink shadow-chip">
                {shown.last?.text ?? shown.sample}
                <span className="mt-4 block text-right font-mono text-micro text-ink-subtle">{formatTime(shown.last?.at ?? Date.now(), timezone)}</span>
              </p>
            </div>
          </div>
          <figcaption className="text-center text-body-sm text-ink-subtle">{shown.last ? 'The last one sent' : 'An example, as it will read'}</figcaption>
        </figure>
      </section>

      {/* ── Which alerts, and to whom ─────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card aria-labelledby="wa-alerts">
          <CardHeader band level="h2" titleId="wa-alerts" icon={IconFileText} title="Alerts" subtitle="Choose one to see it on the phone" />
          <ul className="flex flex-col">
            {templates.map((t) => {
              const Glyph = ALERT_ICON[t.kind];
              const selected = preview === t.kind;
              return (
                <li key={t.kind} className={cx('flex flex-col border-t border-edge first:border-t-0', selected && 'bg-band')}>
                  <div className="flex items-center gap-16 px-20 py-12">
                    <button type="button" onClick={() => setPreview(t.kind)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-16 text-left">
                      <span className={cx('flex size-control-md shrink-0 items-center justify-center rounded-control', alerts[t.kind] ? 'bg-accent-wash text-accent-text' : 'bg-band-strong text-ink-subtle')}>
                        <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-2">
                        <span className="text-ui text-ink">{t.title}</span>
                        <span className="text-body-sm text-ink-muted">{t.when}</span>
                      </span>
                    </button>
                    <div className="shrink-0">
                      <Switch label={<span className="sr-only">{t.title}</span>} checked={alerts[t.kind]} disabled={!canManage} onChange={(next) => setAlerts((a) => ({ ...a, [t.kind]: next }))} />
                    </div>
                  </div>
                  {t.kind === 'void_refund' && alerts.void_refund ? (
                    <div className="flex items-end gap-12 px-20 pb-16 pl-72">
                      <div className="w-[180px]">
                        <TextField label="From, KES" value={voidAlert} mono inputMode="numeric" disabled={!canManage} onChange={(e) => setVoidAlert(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))} />
                      </div>
                      <p className="pb-8 text-body-sm text-ink-subtle">Smaller ones stay in the audit trail.</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card aria-labelledby="wa-who">
          <CardHeader band level="h2" titleId="wa-who" icon={IconUsers} title="Who gets them" subtitle="Kenyan mobile numbers on WhatsApp" />
          <ul className="flex flex-col">
            {recipients.map((r, i) => (
              <li key={i} className="flex flex-col gap-8 border-t border-edge px-20 py-12 first:border-t-0">
                <div className="flex items-center gap-12">
                  <span aria-hidden="true" className={cx('flex size-control-md shrink-0 items-center justify-center rounded-pill text-ui', r.active ? 'bg-accent-wash text-accent-text' : 'bg-band-strong text-ink-subtle')}>
                    {(r.name.trim()[0] ?? '#').toUpperCase()}
                  </span>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-8 compact:grid-cols-2">
                    <TextField label="Name" value={r.name} disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <TextField label="Number" value={r.phone} inputMode="tel" disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                  </div>
                </div>
                <div className="flex items-center justify-between pl-56">
                  <Switch label={<span className="text-body-sm text-ink-muted">{r.active ? 'Receiving alerts' : 'Paused'}</span>} checked={r.active} disabled={!canManage} onChange={(next) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, active: next } : x)))} />
                  {canManage ? <IconButton icon={IconTrash} label={`Remove ${r.name || 'this number'}`} variant="ghost" size="sm" onClick={() => setRecipients((all) => all.filter((_, j) => j !== i))} /> : null}
                </div>
              </li>
            ))}
            {recipients.length === 0 ? <li className="px-20 py-16 text-body text-ink-muted">Nobody gets alerts yet.</li> : null}
          </ul>
          {canManage && recipients.length < 10 ? (
            <div className="border-t border-edge px-20 py-12">
              <Button variant="ghost" icon={IconPlus} onClick={() => setRecipients((all) => [...all, { name: '', phone: '', active: true }])}>
                Add a number
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      {/* ── The templates, as submitted to WhatsApp ───────────────────── */}
      <Card aria-labelledby="wa-templates">
        <CardHeader band level="h2" titleId="wa-templates" icon={IconFileText} title="Templates for WhatsApp Manager" subtitle="A business starts a chat only with an approved template. Copy each exactly." />
        <ul className="flex flex-col">
          {templates.map((t) => {
            const open = openTemplate === t.kind;
            return (
              <li key={t.kind} className="border-t border-edge first:border-t-0">
                <button type="button" aria-expanded={open} onClick={() => setOpenTemplate(open ? null : t.kind)} className="flex w-full items-center gap-12 px-20 py-12 text-left transition-hover hover:bg-band">
                  <span className="text-ui text-ink">{t.title}</span>
                  <span className="font-mono text-body-sm text-ink-subtle">{t.name}</span>
                  <IconChevronDown size={16} stroke={ICON_STROKE} aria-hidden="true" className={cx('ml-auto text-ink-subtle transition-transform', open && 'rotate-180')} />
                </button>
                {open ? (
                  <div className="flex flex-col gap-12 px-20 pb-16">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-16 gap-y-6 text-body-sm">
                      <dt className="text-ink-subtle">Name</dt>
                      <dd className="font-mono text-ink">{t.name}</dd>
                      <dt className="text-ink-subtle">Category</dt>
                      <dd className="text-ink">Utility</dd>
                      <dt className="text-ink-subtle">Language</dt>
                      <dd className="text-ink">English</dd>
                    </dl>
                    <p className="measure rounded-control bg-band px-16 py-12 font-mono text-body-sm text-ink">{t.body}</p>
                    <p className="text-body-sm text-ink-muted">Samples for review: {t.example.map((e, i) => `{{${i + 1}}} ${e}`).join(' · ')}</p>
                    <div className="flex flex-wrap gap-8">
                      <Button variant="outline" size="sm" icon={IconCopy} onClick={() => copy(t.name, 'Name')}>
                        Copy name
                      </Button>
                      <Button variant="outline" size="sm" icon={IconCopy} onClick={() => copy(t.body, 'Template')}>
                        Copy template
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ── What happened to each message ─────────────────────────────── */}
      <Card aria-labelledby="wa-log">
        <CardHeader
          band
          level="h2"
          titleId="wa-log"
          icon={IconHistory}
          title="Messages"
          subtitle="Newest first, with how far each got"
          actions={
            <Segmented
              label="Show"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: messages.length },
                { value: 'failed', label: 'Failed', count: messages.filter((m) => m.status === 'failed').length },
                { value: 'waiting', label: 'Waiting', count: messages.filter((m) => m.status === 'queued' || m.status === 'sending').length },
              ]}
            />
          }
        />
        {log.length === 0 ? (
          <p className="px-20 py-20 text-body text-ink-muted">{filter === 'all' ? 'Nothing yet. Alerts appear here as they are raised.' : 'None.'}</p>
        ) : (
          <ol className="flex flex-col">
            {log.map((m) => (
              <li key={m.id} className="flex gap-16 border-t border-edge px-20 py-12 first:border-t-0">
                <span className="w-[112px] shrink-0 pt-2 font-mono text-body-sm text-ink-subtle">{formatDateTime(m.at, timezone)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-8">
                    <span className="text-ui text-ink">{KIND[m.kind] ?? m.kind}</span>
                    <span className="font-mono text-body-sm text-ink-subtle">{m.to}</span>
                  </div>
                  <p className="measure truncate text-body-sm text-ink-muted" title={m.preview}>
                    {m.preview}
                  </p>
                  {m.error ? <p className="text-body-sm text-stop">{m.error}</p> : null}
                </div>
                <div className="shrink-0">
                  <ToneChip tone={STATUS[m.status].tone}>{m.status === 'failed' && m.attempts < 6 ? 'Retrying' : STATUS[m.status].label}</ToneChip>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ── Unsaved changes ride along at the foot, only while there are any ── */}
      {dirty && canManage ? (
        <div role="region" aria-label="Unsaved changes" className="sticky bottom-16 z-popover mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-12 rounded-card border border-edge bg-card px-20 py-12 shadow-popover">
          <p className="mr-auto text-ui text-ink">Unsaved changes</p>
          {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
          <Button variant="ghost" onClick={discard}>
            Discard
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Save alerts
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-sm bg-sunken px-4 py-2 font-mono text-body-sm text-ink">{children}</code>;
}
