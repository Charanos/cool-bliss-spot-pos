import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, saveUpload, sniff } from '@/modules/_data/uploads';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

/**
 * Console uploads: delivery note photos, invoice scans and staff photos. Signed-in Console staff only.
 * The type comes from the file's own bytes, sizes and counts are capped before anything is stored,
 * and a file is stored under a random id, never a name the browser chose.
 */
export async function POST(request: Request) {
  await fresh();
  const session = identity.checkConsoleSession((await cookies()).get(identity.CONSOLE_COOKIE)?.value);
  if (!session.ok) return NextResponse.json({ ok: false, error: 'Sign in to the Console to upload.' }, { status: 401 });

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_UPLOAD_BYTES * MAX_UPLOAD_FILES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: `Upload at most ${MAX_UPLOAD_FILES} files of up to 8 MB each.` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'That upload did not arrive whole. Try again.' }, { status: 400 });
  }
  const files = [...form.getAll('files'), form.get('file')].filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ ok: false, error: 'Choose a photo or a PDF to upload.' }, { status: 400 });
  if (files.length > MAX_UPLOAD_FILES) return NextResponse.json({ ok: false, error: `Upload at most ${MAX_UPLOAD_FILES} files at once.` }, { status: 400 });

  const checked: { bytes: Buffer; kind: NonNullable<ReturnType<typeof sniff>> }[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, error: `${file.name || 'A file'} is larger than 8 MB. Take the photo again at a lower resolution.` }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniff(bytes);
    if (!kind) return NextResponse.json({ ok: false, error: `${file.name || 'A file'} is not a JPEG, PNG, WebP or PDF.` }, { status: 415 });
    checked.push({ bytes, kind });
  }

  try {
    const urls: string[] = [];
    for (const { bytes, kind } of checked) urls.push(await saveUpload({ bytes, kind, by: session.staff.id }));
    return NextResponse.json({ ok: true, urls, url: urls[0] });
  } catch (error) {
    console.error('[upload]', error);
    return NextResponse.json({ ok: false, error: 'The upload did not save. Try again in a moment.' }, { status: 500 });
  }
}
