import { cookies } from 'next/headers';
import { UPLOAD_MIME, readUpload } from '@/modules/_data/uploads';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * Serve an upload to signed-in Console staff. Served as an attachment-safe download: the type is the
 * one sniffed on the way in, never sniffed again by the browser, and scripts cannot run from it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  await fresh();
  const session = identity.checkConsoleSession((await cookies()).get(identity.CONSOLE_COOKIE)?.value);
  if (!session.ok) return new Response('Sign in to the Console to see this file.', { status: 401 });
  const { file } = await params;
  const match = /^([a-zA-Z0-9_-]{8,64})\.(jpg|png|webp|pdf)$/.exec(file);
  if (!match) return new Response('Not found', { status: 404 });
  const stored = await readUpload(match[1]!);
  if (!stored || stored.mime !== UPLOAD_MIME[match[2] as keyof typeof UPLOAD_MIME]) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(stored.bytes), {
    headers: {
      'content-type': stored.mime,
      'content-length': String(stored.bytes.length),
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      'content-disposition': 'inline',
    },
  });
}
