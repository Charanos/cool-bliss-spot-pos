'use client';

import { formatAgo, formatDate, formatTime } from '@bliss/shared/format';
import type { OutletAlert } from '@bliss/shared/domain';
import { BlissMark } from '@bliss/ui/components/brand';
import { Button, IconButton } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { RingGauge } from '@bliss/ui/components/console/gauges';
import { StackedColumns } from '@bliss/ui/components/console/stacked-columns';
import { useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { Switch, TextField } from '@bliss/ui/components/fields';
import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { type Tone, ToneChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import {
  IconAlertCircle,
  IconBattery4,
  IconCash,
  IconChartBar,
  IconCheck,
  IconChecks,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconEraser,
  IconFileText,
  IconHistory,
  IconMicrophone,
  IconMoodSmile,
  IconMoon,
  IconPackageOff,
  IconPlus,
  IconReceiptRefund,
  IconRosetteDiscountCheckFilled,
  IconSend,
  IconTrash,
  IconUsers,
  IconWifi,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { saveNotifySettings, sendTestAlert } from '../../_actions/settings';

type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
type Recipient = { name: string; phone: string; active: boolean };
type Template = { kind: OutletAlert; name: string; title: string; when: string; body: string; example: string[]; sample: string; last: { text: string; at: number; status: MessageStatus } | null; week: number };
type Message = { id: string; kind: string; to: string; preview: string; status: MessageStatus; attempts: number; error: string | null; at: number };
type Setup = { connected: boolean; token: boolean; phoneNumberId: boolean; webhook: boolean; tested: boolean; approved: boolean; receipts: boolean };
type Delivery = {
  days: { key: string; label: string; reached: number; sent: number; waiting: number; failed: number }[];
  funnel: { created: number; sent: number; delivered: number; read: number; failed: number };
};

const ALERT_ICON: Record<OutletAlert, TablerIcon> = { night_summary: IconMoon, drawer_variance: IconCash, void_refund: IconReceiptRefund, stock_out: IconPackageOff, trade_cleared: IconEraser };
const KIND: Record<string, string> = { night_summary: 'Night summary', drawer_variance: 'Drawer out', void_refund: 'Void or refund', stock_out: 'Item finished', trade_cleared: 'Trade cleared', test: 'Test' };
const STATUS: Record<MessageStatus, { tone: Tone; label: string; icon: TablerIcon }> = {
  queued: { tone: 'info', label: 'Waiting', icon: IconClock },
  sending: { tone: 'info', label: 'Sending', icon: IconClock },
  sent: { tone: 'neutral', label: 'Sent', icon: IconCheck },
  delivered: { tone: 'poured', label: 'Delivered', icon: IconChecks },
  read: { tone: 'accent', label: 'Read', icon: IconChecks },
  failed: { tone: 'stop', label: 'Failed', icon: IconAlertCircle },
};
const WASH: Record<Tone, string> = {
  poured: 'bg-poured-wash text-poured',
  served: 'bg-served-wash text-served',
  low: 'bg-low-wash text-low',
  stop: 'bg-stop-wash text-stop',
  info: 'bg-info-wash text-info',
  neutral: 'bg-neutral-wash text-ink-muted',
  accent: 'bg-accent-wash text-accent-text',
};

/**
 * WhatsApp alerts, around the message itself: what arrives on the phone, the few steps that connect
 * the business number (ticked from the server's own settings), how the last week of alerts went,
 * which alerts go to whom, the templates to have approved, and what happened to each message.
 */
export function WhatsappView({
  canManage,
  now,
  timezone,
  webhookUrl,
  setup,
  settings,
  lastTo,
  delivery,
  templates,
  messages,
}: {
  canManage: boolean;
  /** When the server drew the page, so times read the same on the server and in the browser. */
  now: number;
  timezone: string;
  webhookUrl: string;
  setup: Setup;
  settings: { recipients: Recipient[]; alerts: Record<OutletAlert, boolean>; voidAlert: string };
  lastTo: Record<string, { status: MessageStatus; at: number } | null>;
  delivery: Delivery;
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
  const index = templates.findIndex((t) => t.kind === preview);
  const shown = templates[index]!;
  const active = recipients.filter((r) => r.active && r.phone.trim());
  const on = templates.filter((t) => alerts[t.kind]).length;
  const f = delivery.funnel;
  const rate = (n: number) => (f.sent > 0 ? n / f.sent : 0);

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
          <button type="button" onClick={() => copy(webhookUrl, 'Webhook address')} className="inline-flex items-center gap-4 break-all font-mono text-ink underline decoration-edge-strong underline-offset-4 hover:decoration-accent">
            {webhookUrl}
            <IconCopy size={14} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
          .
        </>
      ),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);
  const log = messages.filter((m) => (filter === 'failed' ? m.status === 'failed' : filter === 'waiting' ? m.status === 'queued' || m.status === 'sending' : true));
  const shownStatus = shown.last?.status ?? 'read';

  return (
    <div className="flex flex-col gap-32 pb-72">
      {/* ── What arrives, and how far the connection has got ───────────── */}
      <section aria-label="Connection" className="grid grid-cols-1 items-stretch gap-24 tablet:grid-cols-[minmax(0,1fr)_340px]">
        <Card aria-labelledby="wa-setup">
          <div className={cx('flex flex-wrap items-center gap-20 border-b border-edge px-24 py-20', setup.connected ? 'bg-poured-wash' : 'card-band')}>
            <RingGauge value={done / steps.length} size="sm" tone={done === steps.length ? 'poured' : setup.connected ? 'accent' : 'low'} label={`Set-up: ${done} of ${steps.length} steps done`}>
              <span className="font-mono tabular text-num-sm text-ink">
                {done}
                <span className="text-micro text-ink-subtle">/{steps.length}</span>
              </span>
            </RingGauge>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className={cx('flex items-center gap-6 label-caps', setup.connected ? 'text-poured' : 'text-low')}>
                <span className={cx('size-dot rounded-dot', setup.connected ? 'animate-breathe bg-poured' : 'bg-low')} aria-hidden="true" />
                {setup.connected ? 'Live' : 'Not connected'}
              </p>
              <h2 id="wa-setup" className="text-title-section text-ink">
                {setup.connected ? 'Alerts are going out' : 'Alerts are ready, waiting for the number'}
              </h2>
              <p className="text-body-sm text-ink-muted">
                {setup.connected ? `${on} of ${templates.length} alerts on, to ${active.length} ${active.length === 1 ? 'number' : 'numbers'}, as they happen.` : 'Everything raised until then is kept and sent once it connects.'}
              </p>
            </div>
            {canManage ? (
              <Button variant={setup.tested ? 'outline' : 'primary'} icon={IconSend} loading={testing} onClick={() => void test()}>
                Send a test
              </Button>
            ) : null}
          </div>
          <ol className="relative flex flex-col px-24 py-8">
            {steps.map((s, i) => {
              const current = i === next;
              return (
                <li key={s.title} className="relative flex gap-16 py-12">
                  {i < steps.length - 1 ? <span aria-hidden="true" className={cx('absolute left-[13px] top-40 -bottom-12 w-2 rounded-pill', s.done ? 'bg-poured' : 'bg-band-strong')} /> : null}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'relative flex size-[28px] shrink-0 items-center justify-center rounded-pill font-mono text-num-sm',
                      s.done ? 'bg-poured text-page' : current ? 'bg-accent text-accent-ink shadow-chip' : 'bg-band-strong text-ink-subtle',
                    )}
                  >
                    {s.done ? <IconCheck size={16} stroke={2.5} /> : i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-4 pt-2">
                    <p className="flex flex-wrap items-center gap-8">
                      <span className={cx('text-ui', s.done ? 'text-ink-muted' : 'text-ink')}>
                        <span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span>
                        {s.title}
                      </span>
                      {current ? <ToneChip tone="accent">Next</ToneChip> : null}
                      {s.done ? <span className="text-micro text-poured">Done</span> : null}
                    </p>
                    {s.done ? null : <p className={cx('measure text-body-sm', current ? 'text-ink-muted' : 'text-ink-subtle')}>{s.body}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* The phone: the chosen alert as it reads on arrival. */}
        <figure aria-label={`${shown.title}, as it arrives`} className="flex flex-col gap-12">
          <div className="mx-auto flex w-full max-w-[340px] flex-1 flex-col overflow-hidden rounded-sheet border border-edge-strong bg-page shadow-popover">
            <div aria-hidden="true" className="flex items-center justify-between px-20 pb-4 pt-12 font-mono text-micro text-ink">
              <span>{formatTime(shown.last?.at ?? now, timezone)}</span>
              <span className="flex items-center gap-4 text-ink-muted">
                <IconWifi size={14} stroke={2} />
                <IconBattery4 size={16} stroke={2} />
              </span>
            </div>
            <div className="flex items-center gap-8 border-b border-edge px-12 pb-12 pt-4">
              <IconChevronLeft size={20} stroke={ICON_STROKE} aria-hidden="true" className="text-accent-text" />
              <BlissMark size={32} surface="light" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-4 text-ui text-ink">
                  Cool Bliss
                  <IconRosetteDiscountCheckFilled size={16} aria-label="Verified business" className="text-poured" />
                </span>
                <span className="text-micro text-ink-subtle">Business account</span>
              </div>
            </div>
            <div className="texture-dots-accent flex min-h-[260px] flex-1 flex-col justify-end gap-8 bg-band px-12 py-16">
              <span className="mx-auto rounded-pill bg-card px-12 py-2 text-micro text-ink-subtle shadow-chip">{shown.last ? formatDate(shown.last.at, timezone) : 'Today'}</span>
              <p className="mx-auto max-w-[92%] rounded-control bg-low-wash px-12 py-6 text-center text-micro text-ink-muted">Messages from this business use a secure service from Meta.</p>
              <div key={shown.kind} className="enter-rise max-w-[88%] rounded-lg rounded-tl-sm bg-card px-12 pb-6 pt-8 shadow-chip">
                <p className="whitespace-pre-line text-body-sm text-ink">{shown.last?.text ?? shown.sample}</p>
                <p className="mt-4 flex items-center justify-end gap-4 font-mono text-micro text-ink-subtle">
                  {formatTime(shown.last?.at ?? now, timezone)}
                  {(() => {
                    const Tick = STATUS[shownStatus].icon;
                    return <Tick size={14} stroke={2} aria-label={STATUS[shownStatus].label} className={shownStatus === 'read' ? 'text-info' : shownStatus === 'failed' ? 'text-stop' : 'text-ink-subtle'} />;
                  })()}
                </p>
              </div>
              {!alerts[shown.kind] ? <p className="mx-auto rounded-pill bg-card px-12 py-4 text-micro text-ink-muted shadow-chip">This alert is off: nobody gets it.</p> : null}
            </div>
            <div aria-hidden="true" className="flex items-center gap-8 px-12 py-8">
              <span className="flex flex-1 items-center gap-8 rounded-pill bg-band px-12 py-8 text-body-sm text-ink-subtle">
                <IconMoodSmile size={18} stroke={ICON_STROKE} />
                Message
              </span>
              <span className="flex size-control-sm items-center justify-center rounded-pill bg-poured text-page">
                <IconMicrophone size={16} stroke={2} />
              </span>
            </div>
          </div>
          <figcaption className="flex items-center justify-center gap-8">
            <IconButton icon={IconChevronLeft} label="Previous alert" variant="ghost" size="sm" onClick={() => setPreview(templates[(index - 1 + templates.length) % templates.length]!.kind)} />
            <span className="min-w-0 text-center text-body-sm text-ink-muted">
              <span className="text-ink">{shown.title}</span>
              <span className="text-ink-subtle"> · {shown.last ? 'the last one sent' : 'an example'}</span>
            </span>
            <IconButton icon={IconChevronRight} label="Next alert" variant="ghost" size="sm" onClick={() => setPreview(templates[(index + 1) % templates.length]!.kind)} />
          </figcaption>
        </figure>
      </section>

      {/* ── How the last seven days went ──────────────────────────────── */}
      <Card aria-labelledby="wa-week">
        <CardHeader band level="h2" titleId="wa-week" icon={IconChartBar} title="The last seven days" subtitle="Every alert, by how far it got. Tests are left out." />
        <div className="grid grid-cols-1 gap-24 px-20 py-20 desktop:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <dl className="grid grid-cols-2 gap-16">
            <WeekFigure label="Alerts made" value={f.created} note={f.created > 0 ? `${f.created - f.sent - f.failed} still waiting` : 'None yet'} />
            <WeekFigure label="Failed" value={f.failed} tone={f.failed > 0 ? 'stop' : undefined} note={f.failed > 0 ? 'See the log below' : 'Nothing failed'} />
            <WeekRing label="Delivered" share={rate(f.delivered)} count={f.delivered} of={f.sent} tone="poured" />
            <WeekRing label="Read" share={rate(f.read)} count={f.read} of={f.sent} tone="accent" />
          </dl>
          {f.created > 0 ? (
            <StackedColumns
              caption="Alerts over the last seven days, by how far they got"
              series={[
                { key: 'reached', label: 'Delivered', tone: 'poured' },
                { key: 'sent', label: 'Sent', tone: 'accent' },
                { key: 'waiting', label: 'Waiting', tone: 'info' },
                { key: 'failed', label: 'Failed', tone: 'stop' },
              ]}
              data={delivery.days.map((d) => ({ key: d.key, label: d.label, values: { reached: d.reached, sent: d.sent, waiting: d.waiting, failed: d.failed } }))}
              height={150}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-8 rounded-control bg-band px-20 py-32 text-center">
              <IconChartBar size={28} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-disabled" />
              <p className="text-body-sm text-ink-muted">{setup.connected ? 'The week fills in as alerts go out.' : 'The week fills in once the number is connected.'}</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Which alerts, and to whom ─────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card aria-labelledby="wa-alerts">
          <CardHeader band level="h2" titleId="wa-alerts" icon={IconFileText} title="Alerts" subtitle="Choose one to see it on the phone" meta={<ToneChip tone={on > 0 ? 'poured' : 'neutral'}>{`${on} of ${templates.length} on`}</ToneChip>} />
          <ul className="flex flex-col">
            {templates.map((t) => {
              const Glyph = ALERT_ICON[t.kind];
              const selected = preview === t.kind;
              const enabled = alerts[t.kind];
              return (
                <li key={t.kind} className={cx('relative flex flex-col border-t border-edge transition-hover first:border-t-0', selected ? 'bg-band' : 'hover:bg-band')}>
                  {selected ? <span aria-hidden="true" className="absolute inset-y-8 left-0 w-2 rounded-pill bg-accent" /> : null}
                  <div className="flex items-center gap-16 px-20 py-16">
                    <button type="button" onClick={() => setPreview(t.kind)} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-16 text-left">
                      <span className={cx('flex size-control-md shrink-0 items-center justify-center rounded-control transition-hover', enabled ? 'bg-accent-wash text-accent-text' : 'bg-band-strong text-ink-disabled')}>
                        <Glyph size={20} stroke={ICON_STROKE} aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-2">
                        <span className={cx('text-ui', enabled ? 'text-ink' : 'text-ink-muted')}>{t.title}</span>
                        <span className="text-body-sm text-ink-muted">{t.when}</span>
                        <span className="flex flex-wrap items-center gap-x-12 gap-y-2 text-micro text-ink-subtle">
                          <span className="font-mono tabular">{t.week} this week</span>
                          {t.last ? (
                            <span className="flex items-center gap-4">
                              <span aria-hidden="true">·</span>
                              {`Last ${formatAgo(now - t.last.at)}`}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    <div className="shrink-0">
                      <Switch label={<span className="sr-only">{t.title}</span>} checked={enabled} disabled={!canManage} onChange={(v) => setAlerts((a) => ({ ...a, [t.kind]: v }))} />
                    </div>
                  </div>
                  {t.kind === 'void_refund' && enabled ? (
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
          <CardHeader band level="h2" titleId="wa-who" icon={IconUsers} title="Who gets them" subtitle="Kenyan mobile numbers on WhatsApp" meta={<ToneChip tone={active.length > 0 ? 'poured' : 'low'}>{`${active.length} receiving`}</ToneChip>} />
          <ul className="flex flex-col">
            {recipients.map((r, i) => {
              const last = lastTo[r.phone] ?? null;
              const Tick = last ? STATUS[last.status].icon : null;
              return (
                <li key={i} className="flex flex-col gap-12 border-t border-edge px-20 py-16 first:border-t-0">
                  <div className="flex items-start gap-12">
                    <span aria-hidden="true" className={cx('relative mt-20 flex size-control-md shrink-0 items-center justify-center rounded-pill text-ui', r.active ? 'bg-accent-wash text-accent-text' : 'bg-band-strong text-ink-subtle')}>
                      {(r.name.trim()[0] ?? '#').toUpperCase()}
                      {r.active ? <span className="absolute -bottom-2 -right-2 flex size-16 items-center justify-center rounded-pill bg-poured text-page shadow-chip"><IconCheck size={10} stroke={3} /></span> : null}
                    </span>
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-8 compact:grid-cols-2">
                      <TextField label="Name" value={r.name} disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <TextField label="Number" value={r.phone} inputMode="tel" disabled={!canManage} onChange={(e) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-12 pl-56">
                    <Switch label={<span className="text-body-sm text-ink-muted">{r.active ? 'Receiving' : 'Paused'}</span>} checked={r.active} disabled={!canManage} onChange={(v) => setRecipients((all) => all.map((x, j) => (j === i ? { ...x, active: v } : x)))} />
                    {last && Tick ? (
                      <span className={cx('inline-flex items-center gap-4 rounded-pill px-8 py-2 text-micro', WASH[STATUS[last.status].tone])}>
                        <Tick size={12} stroke={2} aria-hidden="true" />
                        {`${STATUS[last.status].label} ${formatAgo(now - last.at)}`}
                      </span>
                    ) : (
                      <span className="text-micro text-ink-subtle">Nothing sent yet</span>
                    )}
                    {canManage ? (
                      <span className="ml-auto">
                        <IconButton icon={IconTrash} label={`Remove ${r.name || 'this number'}`} variant="ghost" size="sm" onClick={() => setRecipients((all) => all.filter((_, j) => j !== i))} />
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
            {recipients.length === 0 ? (
              <li className="flex flex-col items-center gap-8 px-20 py-32 text-center">
                <IconUsers size={28} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-disabled" />
                <p className="text-body text-ink-muted">Nobody gets alerts yet.</p>
              </li>
            ) : null}
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
        <CardHeader
          band
          level="h2"
          titleId="wa-templates"
          icon={IconFileText}
          title="Templates for WhatsApp Manager"
          subtitle="A business starts a chat only with an approved template. Copy each exactly."
          meta={<ToneChip tone={setup.approved ? 'poured' : 'low'}>{setup.approved ? 'Approved' : 'To submit'}</ToneChip>}
        />
        <ul className="flex flex-col">
          {templates.map((t) => {
            const open = openTemplate === t.kind;
            const Glyph = ALERT_ICON[t.kind];
            return (
              <li key={t.kind} className="border-t border-edge first:border-t-0">
                <button type="button" aria-expanded={open} onClick={() => setOpenTemplate(open ? null : t.kind)} className="flex w-full items-center gap-12 px-20 py-12 text-left transition-hover hover:bg-band">
                  <Glyph size={18} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
                  <span className="text-ui text-ink">{t.title}</span>
                  <span className="hidden truncate font-mono text-body-sm text-ink-subtle compact:inline">{t.name}</span>
                  <span className="ml-auto font-mono tabular text-micro text-ink-subtle">{`${t.example.length} ${t.example.length === 1 ? 'value' : 'values'}`}</span>
                  <IconChevronDown size={16} stroke={ICON_STROKE} aria-hidden="true" className={cx('shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')} />
                </button>
                {open ? (
                  <div className="grid grid-cols-1 gap-16 px-20 pb-20 desktop:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="flex flex-col gap-8">
                      <p className="label-caps text-ink-subtle">Body</p>
                      <p className="rounded-control bg-band px-16 py-12 font-mono text-body-sm text-ink">
                        {t.body.split(/(\{\{\d+\}\})/).map((part, i) =>
                          /^\{\{\d+\}\}$/.test(part) ? (
                            <span key={i} className="rounded-sm bg-accent-wash px-4 text-accent-text">
                              {part}
                            </span>
                          ) : (
                            <Fragment key={i}>{part}</Fragment>
                          ),
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-12">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-16 gap-y-6 text-body-sm">
                        <dt className="text-ink-subtle">Name</dt>
                        <dd className="break-all font-mono text-ink">{t.name}</dd>
                        <dt className="text-ink-subtle">Category</dt>
                        <dd className="text-ink">Utility</dd>
                        <dt className="text-ink-subtle">Language</dt>
                        <dd className="text-ink">English</dd>
                        {t.example.map((e, i) => (
                          <Fragment key={i}>
                            <dt className="font-mono text-accent-text">{`{{${i + 1}}}`}</dt>
                            <dd className="text-ink-muted">{e}</dd>
                          </Fragment>
                        ))}
                      </dl>
                      <div className="flex flex-wrap gap-8">
                        <Button variant="outline" size="sm" icon={IconCopy} onClick={() => copy(t.name, 'Name')}>
                          Copy name
                        </Button>
                        <Button variant="outline" size="sm" icon={IconCopy} onClick={() => copy(t.body, 'Template')}>
                          Copy template
                        </Button>
                      </div>
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
          <div className="flex flex-col items-center gap-8 px-20 py-32 text-center">
            <IconHistory size={28} stroke={ICON_STROKE} aria-hidden="true" className="text-ink-disabled" />
            <p className="text-body text-ink-muted">{filter === 'all' ? 'Nothing yet. Alerts appear here as they are raised.' : filter === 'failed' ? 'Nothing failed.' : 'Nothing waiting.'}</p>
          </div>
        ) : (
          <ol className="flex flex-col">
            {log.map((m, i) => {
              const day = formatDate(m.at, timezone);
              const newDay = i === 0 || formatDate(log[i - 1]!.at, timezone) !== day;
              const s = STATUS[m.status];
              const Glyph = s.icon;
              return (
                <Fragment key={m.id}>
                  {newDay ? <li className="border-t border-edge bg-band px-20 py-6 label-caps text-ink-subtle first:border-t-0">{day}</li> : null}
                  <li className="flex items-start gap-16 border-t border-edge px-20 py-12">
                    <span className={cx('mt-2 flex size-control-sm shrink-0 items-center justify-center rounded-pill', WASH[s.tone])}>
                      <Glyph size={16} stroke={2} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                        <span className="text-ui text-ink">{KIND[m.kind] ?? m.kind}</span>
                        <span className="font-mono text-body-sm text-ink-subtle">{m.to}</span>
                        <span className="font-mono text-micro text-ink-subtle">{formatTime(m.at, timezone)}</span>
                      </div>
                      <p className="measure truncate text-body-sm text-ink-muted" title={m.preview}>
                        {m.preview}
                      </p>
                      {m.error ? <p className="text-body-sm text-stop">{m.error}</p> : null}
                    </div>
                    <div className="shrink-0">
                      <ToneChip tone={s.tone}>{m.status === 'failed' && m.attempts < 6 ? `Retrying, ${m.attempts} of 6` : s.label}</ToneChip>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </Card>

      {/* ── Unsaved changes ride along at the foot, only while there are any ── */}
      {dirty && canManage ? (
        <div role="region" aria-label="Unsaved changes" className="enter-rise sticky bottom-16 z-popover mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-12 rounded-pill border border-edge bg-card py-8 pl-24 pr-8 shadow-popover">
          <span aria-hidden="true" className="size-dot animate-breathe rounded-dot bg-low" />
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

function WeekFigure({ label, value, note, tone }: { label: string; value: number; note: string; tone?: 'stop' }) {
  return (
    <div className="flex flex-col gap-4 rounded-control bg-band px-16 py-12">
      <dt className="text-body-sm text-ink-muted">{label}</dt>
      <dd className={cx('font-mono tabular text-num-kpi', tone === 'stop' ? 'text-stop' : 'text-ink')}>{value}</dd>
      <dd className="text-micro text-ink-subtle">{note}</dd>
    </div>
  );
}

function WeekRing({ label, share, count, of, tone }: { label: string; share: number; count: number; of: number; tone: Tone }) {
  return (
    <div className="flex items-center gap-12 rounded-control bg-band px-16 py-12">
      <RingGauge value={share} size="sm" tone={tone} label={`${label}: ${count} of ${of} sent`}>
        <span className="font-mono tabular text-micro text-ink">{of > 0 ? `${Math.round(share * 100)}%` : '–'}</span>
      </RingGauge>
      <div className="flex min-w-0 flex-col gap-2">
        <dt className="text-body-sm text-ink-muted">{label}</dt>
        <dd className="font-mono tabular text-num-md text-ink">
          {count}
          <span className="text-micro text-ink-subtle"> of {of} sent</span>
        </dd>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-sm bg-band-strong px-4 py-2 font-mono text-body-sm text-ink">{children}</code>;
}
