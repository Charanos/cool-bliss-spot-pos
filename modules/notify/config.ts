import type { AlertKind } from '@bliss/db/seed/types';
import type { NotifySettings, OutletAlert } from '@bliss/shared/domain';
import { shillings } from '@bliss/shared/money';

/**
 * WhatsApp alerts, docs/20. A message a business starts must use a template WhatsApp has approved,
 * so every alert is one: its name, its body with numbered blanks, and an example to submit with it.
 * The wording here is what is submitted in WhatsApp Manager, word for word; the Console shows it.
 */
export interface AlertTemplate {
  kind: OutletAlert;
  /** The template's name in WhatsApp Manager. */
  name: string;
  /** What it is, in the Console. */
  title: string;
  /** When it is sent, in the Console. */
  when: string;
  /** The body as submitted: {{1}}, {{2}} ... are filled in order. */
  body: string;
  example: string[];
}

export const TEMPLATES: Record<OutletAlert, AlertTemplate> = {
  night_summary: {
    kind: 'night_summary',
    name: 'bliss_night_summary',
    title: 'Night summary',
    when: 'When the last drawer of the business day closes, or the morning after if none was closed.',
    body: 'Cool Bliss summary for {{1}}. Net sales KES {{2}} from {{3}} bills. Cash KES {{4}}, M-Pesa KES {{5}}, card KES {{6}}. Voided KES {{7}}. Drawers: {{8}}.',
    example: ['Mon 29 Sep', '84,350', '61', '22,100', '58,900', '3,350', '1,200', 'Counter 1 exact'],
  },
  drawer_variance: {
    kind: 'drawer_variance',
    name: 'bliss_drawer_variance',
    title: 'Drawer over or short',
    when: 'When a drawer closes more than the allowance over or short.',
    body: 'Cool Bliss drawer alert: {{1}} closed {{2}} by KES {{3}}. Counted KES {{4}}, expected KES {{5}}. Closed by {{6}}, who said: {{7}}.',
    example: ['Counter 1', 'short', '1,500', '38,500', '40,000', 'Grace', 'Change given wrong to table 7'],
  },
  void_refund: {
    kind: 'void_refund',
    name: 'bliss_void_refund',
    title: 'Void or refund',
    when: 'When a line, a bill or a refund is at or above the amount set below.',
    body: 'Cool Bliss alert: {{1}} of KES {{2}} on {{3}}, by {{4}}. Reason given: {{5}}.',
    example: ['A void', '5,000', 'Table 4, Black Label 750ml', 'Peter', 'Wrong bottle opened for the guest'],
  },
  stock_out: {
    kind: 'stock_out',
    name: 'bliss_stock_out',
    title: 'Item finished',
    when: 'When a counted item runs out during service. Once per item a night.',
    body: 'Cool Bliss stock alert: {{1}} ran out at {{2}}. The floor shows it as finished until stock is booked in or counted.',
    example: ['Tusker Lager 500ml', '21:40'],
  },
  trade_cleared: {
    kind: 'trade_cleared',
    name: 'bliss_trade_cleared',
    title: 'Trade cleared',
    when: 'When an owner clears trade from Settings, Sync.',
    body: 'Cool Bliss: all trade was cleared by {{1}} at {{2}}: {{3}}. Reason given: {{4}}.',
    example: ['Dan', '09:15', '12 tabs, 10 bills', 'Trial run with the staff is over'],
  },
};

/** The test uses WhatsApp's own template, which every business number has from the start. */
export const TEST_TEMPLATE = { name: 'hello_world', language: 'en_US' } as const;

export const ALERT_ORDER: readonly OutletAlert[] = ['night_summary', 'drawer_variance', 'void_refund', 'stock_out', 'trade_cleared'];

/** Who gets alerts until the owner changes it: the two numbers the venue gave. */
export const DEFAULT_SETTINGS: NotifySettings = {
  recipients: [
    { name: 'Owner', phone: '254140490464', active: true },
    { name: 'Cool Bliss line', phone: '254118933850', active: true },
  ],
  alerts: { night_summary: true, drawer_variance: true, void_refund: true, stock_out: true, trade_cleared: true },
  voidAlertCents: shillings(1000),
};

/**
 * A Kenyan number as WhatsApp wants it, 254 and nine digits with no plus: "0118 933 850",
 * "+254 118 933 850" and "254 0118 933 850" all become 254118933850. Null when it is not one.
 */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/[^0-9]/g, '');
  if (d.startsWith('2540')) d = `254${d.slice(4)}`;
  else if (d.startsWith('0')) d = `254${d.slice(1)}`;
  else if (d.length === 9 && /^[17]/.test(d)) d = `254${d}`;
  return /^254[17]\d{8}$/.test(d) ? d : null;
}

/** "254118933850" as people read it: "+254 118 933 850". */
export function displayPhone(e164: string): string {
  return e164.length === 12 ? `+${e164.slice(0, 3)} ${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}` : `+${e164}`;
}

/** A template's body with its blanks filled, as the message reads. */
export function render(body: string, params: readonly string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? '');
}

/**
 * WhatsApp refuses a parameter with a line break, a tab or more than four spaces in a row, and caps
 * its length. Every value is cleaned before it is queued.
 */
export function cleanParam(value: string): string {
  const flat = value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return (flat || '-').slice(0, 900);
}

/** Connection settings, from the environment; never shown or logged. */
export function whatsappEnv() {
  const token = process.env.WHATSAPP_TOKEN ?? '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  return {
    configured: Boolean(token && phoneNumberId),
    token,
    phoneNumberId,
    version: process.env.WHATSAPP_API_VERSION || 'v21.0',
    /** Only for a test double of the Graph API; production leaves it unset. */
    base: (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com').replace(/\/$/, ''),
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  };
}

export type { AlertKind };
