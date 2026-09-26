'use client';

import { Button } from '@bliss/ui/components/button';
import type { ButtonVariant } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { type ToastInput, useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconCamera, IconTrash } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState, useTransition } from 'react';
import type { ActionResult } from '../_lib/action-result';
import { uploadFiles } from '../_lib/upload';


const PAST: Record<string, string> = {
  add: 'added',
  save: 'saved',
  remove: 'removed',
  delete: 'deleted',
  void: 'voided',
  refund: 'refunded',
  close: 'closed',
  mark: 'marked',
  take: 'taken',
  put: 'put',
  stop: 'stopped',
  archive: 'archived',
  rename: 'renamed',
  register: 'registered',
  move: 'moved',
  hand: 'handed',
  end: 'ended',
  bring: 'brought',
  raise: 'raised',
  cancel: 'cancelled',
  approve: 'approved',
  receive: 'received',
  reset: 'reset',
  set: 'set',
  change: 'changed',
  copy: 'copied',
  sell: 'selling',
  use: 'used',
  withdraw: 'withdrawn',
  show: 'shown',
};
const PARTICLES = new Set(['off', 'back', 'over', 'on', 'out', 'up', 'reviewed', 'resolved', 'as', 'in', 'from', 'again']);

/**
 * The confirmation a button's own words imply: "Add product" is "Product added", "Void the bill" is
 * "Bill voided", "Take off sale" is "Taken off sale". A label it cannot read becomes "Done".
 */
export function doneFrom(label: string): string {
  const words = label.replace(/\s+KES\s+[\d,.]+$/, '').trim().split(/\s+/);
  const verb = words[0]?.toLowerCase() ?? '';
  const past = PAST[verb];
  if (!past) return 'Done';
  const rest = words.slice(1);
  if (rest.length === 0) return past.charAt(0).toUpperCase() + past.slice(1);
  if (PARTICLES.has(rest[0]!.toLowerCase())) return `${past.charAt(0).toUpperCase()}${past.slice(1)} ${rest.join(' ')}`;
  const subject = (rest[0]!.toLowerCase() === 'the' || rest[0]!.toLowerCase() === 'a' ? rest.slice(1) : rest).join(' ');
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${past}`;
}

type ToastOption<R> = false | string | ToastInput | ((result: R) => string | ToastInput | false);

function toToast<R>(option: ToastOption<R> | undefined, fallback: string, result: R): ToastInput | null {
  const value = typeof option === 'function' ? option(result) : option;
  if (value === false) return null;
  if (value === undefined) return { title: fallback };
  return typeof value === 'string' ? { title: value } : value;
}

/**
 * The Console's form dialogs, docs/19 section 3. One shape for every create and edit: a title that
 * names the thing, fields in fieldsets, a refusal shown above them in the server's own words, and
 * Cancel beside the one action. On success the dialog closes and the page reads fresh data.
 */
export function FormDialog<R extends object>({
  open,
  onClose,
  title,
  description,
  submitLabel,
  submitVariant = 'primary',
  width = 'lg',
  onSubmit,
  onDone,
  toast,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  width?: 'md' | 'lg';
  /** Run the action. Its refusal is shown; its success closes the dialog. */
  onSubmit: () => Promise<ActionResult<R>>;
  /** After success, before the page refreshes: go to the new record, show a one-time code. */
  onDone?: (result: ActionResult<R> & { ok: true }) => void;
  /** What the toast says on success: by default the button's words, done. `false` for none. */
  toast?: ToastOption<ActionResult<R> & { ok: true }>;
  children: ReactNode;
}) {
  const router = useRouter();
  const notify = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    start(async () => {
      const result = await onSubmit();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      onDone?.(result as ActionResult<R> & { ok: true });
      const done = toToast(toast, doneFrom(submitLabel), result as ActionResult<R> & { ok: true });
      if (done) notify({ tone: 'success', ...done });
      router.refresh();
    });
  }

  return (
    <ConsoleOverlay open={open} onClose={onClose} title={title} description={description} width={width}>
      <form onSubmit={submit} className="flex flex-col gap-24">
        {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
        {children}
        <div className="flex justify-end gap-12 border-t border-rule pt-16">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant={submitVariant} loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </ConsoleOverlay>
  );
}

/** A group of fields with a label in capitals. Two columns on a desktop. */
export function Fieldset({ legend, columns = 2, children, className }: { legend?: string; columns?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cx('grid grid-cols-1 gap-16', columns === 2 ? 'desktop:grid-cols-2' : columns === 3 ? 'desktop:grid-cols-3' : null, className)}>
      {legend ? <legend className="mb-8 label-caps text-ink-subtle">{legend}</legend> : null}
      {children}
    </fieldset>
  );
}

/**
 * A change that needs a reason: archive, void, refund, delete. The reason is written for the audit
 * trail, at least ten characters; the destructive ones never take default focus.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  quickReasons = [],
  destructive = true,
  run,
  toast,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  quickReasons?: readonly string[];
  destructive?: boolean;
  run: (reason: string) => Promise<ActionResult<object>>;
  toast?: ToastOption<ActionResult<object> & { ok: true }>;
  children?: ReactNode;
}) {
  const router = useRouter();
  const notify = useToast();
  return (
    <ConsoleOverlay open={open} onClose={onClose} title={title} description={description} width="md">
      {open ? (
        <ReasonForm
          destructive={destructive}
          quickReasons={[...quickReasons]}
          confirmLabel={confirmLabel}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            const result = await run(reason);
            if (!result.ok) throw new Error(result.message);
            onClose();
            const done = toToast(toast, doneFrom(confirmLabel), result as ActionResult<object> & { ok: true });
            if (done) notify({ tone: 'success', ...done });
            router.refresh();
          }}
        >
          {children}
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}

/**
 * Open the page's create dialog when it arrives as ?new=1 (from the command menu or another page's
 * "Add" link), then take the parameter off the address so a reload does not open it again.
 */
export function useCreateParam(open: () => void, allowed = true) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get('new') !== '1') return;
    if (allowed) open();
    const next = new URLSearchParams(window.location.search);
    next.delete('new');
    window.history.replaceState(null, '', next.size > 0 ? `?${next.toString()}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the address changes, not when the opener is rebuilt
  }, [params, allowed]);
}

/** Which dialog is open, and for which record: one piece of state per page. */
export function useDialog<K extends string, T = null>() {
  const [state, setState] = useState<{ kind: K; target: T } | null>(null);
  return {
    open: (kind: K, target: T) => setState({ kind, target }),
    close: () => setState(null),
    is: (kind: K) => state?.kind === kind,
    target: state?.target ?? null,
  };
}

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const;

/** Days of the week as toggles, Monday first. */
export function DaysField({ label, value, onChange, helper }: { label: string; value: readonly number[]; onChange: (days: number[]) => void; helper?: string }) {
  return (
    <div className="flex flex-col gap-6" role="group" aria-label={label}>
      <span className="text-label text-ink-muted">{label}</span>
      <div className="flex flex-wrap gap-6">
        {DAYS.map((d) => {
          const on = value.includes(d.value);
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== d.value) : [...value, d.value].sort())}
              className={cx('h-control-sm min-w-control-md rounded-md px-8 text-body-sm font-medium transition-hover', on ? 'bg-ink text-page' : 'bg-control text-ink-muted hover:bg-control-hover hover:text-ink')}
            >
              {d.label}
            </button>
          );
        })}
      </div>
      {helper ? <span className="text-body-sm text-ink-subtle">{helper}</span> : null}
    </div>
  );
}

/** A photograph chosen, uploaded and previewed in place. Empty shows the name's initial. */
export function PhotoField({ value, onChange, name, disabled }: { value: string | null; onChange: (url: string | null) => void; name: string; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    const result = await uploadFiles([file]);
    setUploading(false);
    if (result.ok) onChange(result.urls[0] ?? null);
    else setError(result.message);
  }
  return (
    <div className="flex items-center gap-16">
      <label className="group relative flex size-avatar shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-control bg-control text-title-card text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} disabled={uploading || disabled} aria-label="Choose a photograph" />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload, sized by CSS
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
        )}
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-scrim text-on-scrim opacity-0 transition-hover group-hover:opacity-100">
          <IconCamera size={20} stroke={1.5} />
        </span>
      </label>
      <div className="flex min-w-0 flex-col gap-4">
        <span className="text-body-sm text-ink-muted">{uploading ? 'Uploading the photograph' : error || 'A photograph for the floor tile and the Console. JPEG, PNG or WebP.'}</span>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="inline-flex w-fit items-center gap-6 rounded-sm text-body-sm text-stop transition-hover hover:text-ink">
            <IconTrash size={14} stroke={1.5} aria-hidden="true" />
            Remove the photograph
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** A one-time secret shown once, large and spaced, with what to do with it. */
export function OneTimeCode({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-12 rounded-card bg-band px-24 py-24 text-center">
      <span className="font-mono tabular text-num-kpi text-ink">{code.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
      <p className="measure text-body-sm text-ink-muted">{children}</p>
    </div>
  );
}
