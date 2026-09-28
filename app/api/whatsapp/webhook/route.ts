import { createHmac, timingSafeEqual } from 'node:crypto';
import { whatsappEnv } from '@/modules/notify/config';
import { applyStatuses } from '@/modules/notify/send';

export const dynamic = 'force-dynamic';

/**
 * WhatsApp's webhook, docs/20. GET is the one-time check WhatsApp makes when the URL is saved in the
 * app's settings; POST carries what happened to each message (sent, delivered, read, failed). Every
 * POST must be signed with the app secret, or it is refused.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const env = whatsappEnv();
  if (url.searchParams.get('hub.mode') === 'subscribe' && env.verifyToken && url.searchParams.get('hub.verify_token') === env.verifyToken) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const env = whatsappEnv();
  const raw = await request.text();
  if (!env.appSecret) return new Response('Not configured', { status: 503 });
  const signature = request.headers.get('x-hub-signature-256') ?? '';
  const expected = `sha256=${createHmac('sha256', env.appSecret).update(raw).digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response('Bad signature', { status: 401 });

  let body: { entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad body', { status: 400 });
  }
  const statuses = (body.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.statuses ?? []));
  await applyStatuses(statuses);
  return new Response('OK', { status: 200 });
}
