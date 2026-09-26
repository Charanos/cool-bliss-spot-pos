import 'server-only';

import { randomBytes } from 'node:crypto';
import { storeEnabled, storePool } from './store';

/**
 * Uploaded files: delivery note photos, invoice scans and staff photos. They live in Postgres beside
 * the outlet's data, so every server instance can serve them and a deploy loses none. Without a
 * database (development, tests) they are held in memory.
 */

export type UploadKind = 'jpg' | 'png' | 'webp' | 'pdf';

export const UPLOAD_MIME: Record<UploadKind, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 12;

/** What the bytes are, from their first bytes, never from the name or the browser's claim. */
export function sniff(bytes: Uint8Array): UploadKind | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return 'png';
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'webp';
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46 && at(4) === 0x2d) return 'pdf';
  return null;
}

/** The path an upload is served at. Services accept only paths of this shape. */
export const uploadPath = (id: string, kind: UploadKind) => `/api/uploads/${id}.${kind}`;
export const UPLOAD_PATH = /^\/api\/uploads\/([a-zA-Z0-9_-]{8,64})\.(jpg|png|webp|pdf)$/;

interface Stored {
  mime: string;
  bytes: Buffer;
}

const memory = (globalThis as unknown as { __blissUploads?: Map<string, Stored> }).__blissUploads ?? new Map<string, Stored>();
(globalThis as unknown as { __blissUploads?: Map<string, Stored> }).__blissUploads = memory;

export async function saveUpload(input: { bytes: Buffer; kind: UploadKind; by: string }): Promise<string> {
  const id = randomBytes(18).toString('base64url');
  const mime = UPLOAD_MIME[input.kind];
  if (storeEnabled()) {
    const pool = await storePool();
    await pool.query('insert into bliss_upload (id, mime, bytes, size, created_by, created_at) values ($1, $2, $3, $4, $5, $6)', [id, mime, input.bytes, input.bytes.length, input.by, Date.now()]);
  } else {
    memory.set(id, { mime, bytes: input.bytes });
  }
  return uploadPath(id, input.kind);
}

export async function readUpload(id: string): Promise<Stored | null> {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return null;
  if (storeEnabled()) {
    const pool = await storePool();
    const r = await pool.query('select mime, bytes from bliss_upload where id = $1', [id]);
    const row = r.rows[0];
    return row ? { mime: String(row.mime), bytes: row.bytes as Buffer } : null;
  }
  return memory.get(id) ?? null;
}
