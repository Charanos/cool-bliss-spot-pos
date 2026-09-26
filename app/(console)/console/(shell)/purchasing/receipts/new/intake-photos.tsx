'use client';

import { plural } from '@bliss/shared/format';
import { Button, IconButton } from '@bliss/ui/components/button';
import { ImageLightbox } from '@bliss/ui/components/console/lightbox';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { cx } from '@bliss/ui/lib/cx';
import { IconCamera, IconPhotoPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { uploadFiles } from '../../../_lib/upload';

const MAX = 12;

/**
 * Photos and scans of the delivery note, the invoice or a damaged crate. The server decides what a
 * file is from its bytes; this carries files there, shows what came back, and opens one full size.
 */
export function IntakePhotos({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const files = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function add(list: File[]) {
    setError('');
    const room = MAX - urls.length;
    if (room <= 0) {
      setError(`A delivery holds at most ${MAX} photos. Remove one to add another.`);
      return;
    }
    setUploading(true);
    const result = await uploadFiles(list.slice(0, room));
    setUploading(false);
    if (result.ok) onChange([...urls, ...result.urls]);
    else setError(result.message);
    if (list.length > room) setError(`Only ${plural(room, 'photo')} added. A delivery holds at most ${MAX}.`);
  }

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (chosen.length > 0) void add(chosen);
  };

  return (
    <div className="flex flex-col gap-12">
      <input ref={files} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
      <input ref={camera} type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) void add(Array.from(e.dataTransfer.files));
        }}
        className={cx('rounded-md border border-dashed transition-hover', dragging ? 'border-accent bg-accent-wash' : 'border-edge-strong')}
      >
        {urls.length === 0 ? (
          <div className="flex flex-col items-center gap-12 px-20 py-32 text-center">
            <IconPhotoPlus size={24} stroke={1.5} aria-hidden="true" className="text-ink-subtle" />
            <div className="flex flex-col gap-4">
              <p className="text-ui text-ink">{uploading ? 'Uploading' : 'Drop the delivery note here'}</p>
              <p className="measure text-body-sm text-ink-muted">Or a stamped invoice, or a photo of a damaged crate. A photo or a PDF.</p>
            </div>
            <div className="flex gap-8">
              <Button type="button" size="sm" variant="secondary" icon={IconUpload} onClick={() => files.current?.click()} loading={uploading}>
                Choose files
              </Button>
              <Button type="button" size="sm" variant="ghost" icon={IconCamera} onClick={() => camera.current?.click()} disabled={uploading}>
                Take a photo
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-12 p-12 desktop:grid-cols-6">
            {urls.map((url, i) => (
              <li key={url} className="group relative aspect-square overflow-hidden rounded-md bg-thumb">
                <button
                  type="button"
                  onClick={() => (url.endsWith('.pdf') ? window.open(url, '_blank', 'noopener') : setPreview(i))}
                  className="size-full rounded-md"
                  aria-label={url.endsWith('.pdf') ? `Open scan ${i + 1} in a new tab` : `Open photo ${i + 1} full size`}
                >
                  {url.endsWith('.pdf') ? (
                    <span className="flex size-full items-center justify-center text-label text-ink-muted">PDF</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- an upload served by the Console
                    <img src={url} alt="" className="size-full object-cover" />
                  )}
                </button>
                <span className="absolute right-4 top-4 opacity-0 transition-hover group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton icon={IconTrash} label={`Remove photo ${i + 1}`} size="xs" variant="secondary" onClick={() => onChange(urls.filter((u) => u !== url))} />
                </span>
              </li>
            ))}
            {urls.length < MAX ? (
              <li>
                <button
                  type="button"
                  onClick={() => files.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-md bg-band text-body-sm text-ink-muted transition-hover hover:bg-band-strong hover:text-ink"
                >
                  <IconPhotoPlus size={20} stroke={1.5} aria-hidden="true" />
                  {uploading ? 'Uploading' : 'Add'}
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
      {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
      <ImageLightbox src={preview === null ? null : (urls[preview] ?? null)} alt={`Delivery photo ${(preview ?? 0) + 1}`} title={`Photo ${(preview ?? 0) + 1} of ${urls.length}`} onClose={() => setPreview(null)} />
    </div>
  );
}
