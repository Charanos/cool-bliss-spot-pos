'use client';

export type UploadResult = { ok: true; urls: string[] } | { ok: false; message: string };

/**
 * Send files to the Console upload route. The server decides what a file is from its bytes; this only
 * carries them there and brings back the paths to store.
 */
export async function uploadFiles(files: readonly File[]): Promise<UploadResult> {
  if (files.length === 0) return { ok: true, urls: [] };
  const form = new FormData();
  for (const file of files) form.append('files', file);
  try {
    const response = await fetch('/api/upload', { method: 'POST', body: form });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; urls?: string[]; error?: string } | null;
    if (!response.ok || !body?.ok || !body.urls) return { ok: false, message: body?.error ?? 'The upload did not go through. Try again.' };
    return { ok: true, urls: body.urls };
  } catch {
    return { ok: false, message: 'No connection. The upload did not go through.' };
  }
}
