'use client';

import { Button } from '@bliss/ui/components/button';
import type { ButtonVariant } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { type ToastInput, useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconPhotoPlus, IconTrash } from '@tabler/icons-react';
import type { TablerIcon } from '@bliss/ui/components/icon';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useId, useState, useTransition } from 'react';
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
  const words = label
    .replace(/\s+KES\s+[\d,.]+$/, '')
    .trim()
    .split(/\s+/);
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
  icon: Glyph,
  disabled,
  aside,
  summary,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** The record's kind, in a tile beside the title: a bottle for a product, a person for staff. */
  icon?: TablerIcon;
  /** Hold the outcome back while something is still happening, such as an upload. */
  disabled?: boolean;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  width?: 'md' | 'lg' | 'xl';
  /**
   * A column beside the fields, from a desktop up: what the record will look like, its photograph,
   * and its facts as they stand. Above the fields on anything narrower. Makes the dialog two panes.
   */
  aside?: ReactNode;
  /** One line at the foot, beside the actions: the record as entered so far, read back. */
  summary?: ReactNode;
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
  const formId = useId();

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

  // The actions ride in the dialog's footer, so a long form never pushes them out of reach; the
  // submit button is tied to the form by id.
  return (
    <ConsoleOverlay
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={aside ? 'xl' : width}
      flush={Boolean(aside)}
      leading={
        Glyph ? (
          <span className="flex size-control-md items-center justify-center rounded-control bg-accent-wash text-accent-text">
            <Glyph size={20} stroke={1.5} />
          </span>
        ) : undefined
      }
      footer={
        <>
          {summary ? (
            <p aria-live="polite" className="mr-auto hidden min-w-0 truncate text-body-sm text-ink-muted desktop:block">
              {summary}
            </p>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={submitVariant} loading={pending} disabled={disabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {aside ? (
        <div className="flex flex-col desktop:min-h-full desktop:flex-row">
          {/* The column runs the full height of the dialog; what is in it stays in view as the fields scroll. */}
          <aside className="shrink-0 border-b border-edge bg-band px-24 py-24 desktop:w-dialog-aside desktop:border-b-0 desktop:border-r">
            <div className="flex flex-col gap-24 desktop:sticky desktop:top-24">{aside}</div>
          </aside>
          <form id={formId} onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-40 px-24 py-24 desktop:px-32">
            {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
            {children}
          </form>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} className="flex flex-col gap-32 pt-8">
          {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
          {children}
        </form>
      )}
    </ConsoleOverlay>
  );
}

/**
 * A group of fields: a heading in capitals running into a hairline, an optional line saying what the
 * group is for, then the fields, two columns on a desktop.
 */
export function Fieldset({ legend, hint, step, columns = 2, children, className }: { legend?: string; hint?: string; step?: number; columns?: 1 | 2 | 3; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cx('grid grid-cols-1 gap-x-24 gap-y-20', columns === 2 ? 'desktop:grid-cols-2' : columns === 3 ? 'desktop:grid-cols-3' : null, className)}>
      {legend && step ? (
        // A numbered step: the number in a ring, the name of the step, and what it is for under it.
        <legend className="mb-20 flex w-full items-start gap-12">
          <span aria-hidden="true" className="mt-2 flex size-24 shrink-0 items-center justify-center rounded-dot bg-accent-wash font-mono text-label font-medium text-accent-text ring-1 ring-inset ring-accent/25">
            {step}
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            <span className="text-body font-medium text-ink">{legend}</span>
            {hint ? <span className="text-body-sm text-ink-muted">{hint}</span> : null}
          </span>
        </legend>
      ) : legend ? (
        <legend className="mb-16 flex w-full flex-col gap-4">
          <span className="flex items-center gap-12">
            <span className="label-caps shrink-0 text-ink-subtle">{legend}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-rule" />
          </span>
          {hint ? <span className="text-body-sm text-ink-muted">{hint}</span> : null}
        </legend>
      ) : null}
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
              className={cx(
                'h-control-sm min-w-control-md rounded-md px-8 text-body-sm font-medium transition-hover',
                on ? 'bg-ink text-page' : 'bg-control text-ink-muted hover:bg-control-hover hover:text-ink',
              )}
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
/**
 * A photograph for a record: a tile to drop onto or tap, the picture once there is one, and a line
 * saying what it is for. Round for a person, square for anything else.
 */
export function PhotoField({
  value,
  onChange,
  name,
  disabled,
  shape = 'square',
  helper = 'A photograph for the floor tile and the Console. JPEG, PNG or WebP.',
  onUploading,
  layout = 'row',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  name: string;
  /** `panel` is a full-width drop zone for the side column of a two-pane form. */
  layout?: 'row' | 'panel';
  disabled?: boolean;
  shape?: 'square' | 'round';
  helper?: string;
  onUploading?: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  async function take(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    onUploading?.(true);
    setError('');
    const result = await uploadFiles([file]);
    setUploading(false);
    onUploading?.(false);
    if (result.ok) onChange(result.urls[0] ?? null);
    else setError(result.message);
  }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void take(file);
  }
  const initial = name.trim().charAt(0).toUpperCase();
  if (layout === 'panel') {
    return (
      <div className="flex flex-col gap-8">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void take(e.dataTransfer.files?.[0]);
          }}
          className={cx(
            'group relative flex min-h-row-floor cursor-pointer items-center gap-12 rounded-card border px-12 py-12 transition-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
            over ? 'border-dashed border-accent bg-accent-wash' : 'border-dashed border-edge-strong bg-card hover:border-accent hover:bg-accent-wash',
          )}
        >
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} disabled={uploading || disabled} aria-label="Choose a photograph" />
          <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-accent-wash text-accent-text">
            <IconPhotoPlus size={18} stroke={1.5} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-body-sm font-medium text-ink">{uploading ? 'Uploading' : value ? 'Change the photograph' : 'Add a photograph'}</span>
            <span className={cx('text-label', error ? 'text-stop' : 'text-ink-subtle')}>{error || 'Drop it here, or click. JPEG, PNG or WebP.'}</span>
          </span>
          {uploading ? <span aria-hidden="true" className="absolute inset-0 animate-breathe rounded-card bg-scrim" /> : null}
        </label>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="inline-flex w-fit items-center gap-6 rounded-sm text-label text-ink-subtle transition-hover hover:text-stop">
            <IconTrash size={14} stroke={1.5} aria-hidden="true" />
            Remove it
          </button>
        ) : (
          <span className="text-label text-ink-subtle">{helper}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-20">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          'group relative flex size-avatar-lg shrink-0 cursor-pointer items-center justify-center overflow-hidden border transition-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus',
          shape === 'round' ? 'rounded-dot' : 'rounded-card',
          value ? 'border-edge' : over ? 'border-dashed border-accent bg-accent-wash' : 'border-dashed border-edge-strong bg-band hover:border-accent hover:bg-accent-wash',
        )}
      >
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choose} disabled={uploading || disabled} aria-label="Choose a photograph" />
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- an upload, sized by CSS
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex flex-col items-center gap-4 text-ink-subtle transition-hover group-hover:text-accent-text">
            {initial && shape === 'round' ? <span className="text-title-card text-ink-muted">{initial}</span> : <IconPhotoPlus size={22} stroke={1.5} />}
          </span>
        )}
        {uploading ? <span aria-hidden="true" className="absolute inset-0 animate-breathe bg-scrim" /> : null}
      </label>
      <div className="flex min-w-0 flex-col gap-6">
        <span className="text-body-sm font-medium text-ink">{uploading ? 'Uploading the photograph' : value ? 'Photograph' : 'Add a photograph'}</span>
        <span className={cx('text-body-sm', error ? 'text-stop' : 'text-ink-muted')}>{error || `${helper} Drop it here or tap the tile.`}</span>
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

/**
 * A choice between a few ways, as cards: a name and a line saying what it means, the chosen one
 * ringed in the accent. A radio group underneath, so arrows and a screen reader work as usual.
 */
export function ChoiceCards<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { value: T; title: string; detail: string; icon?: TablerIcon }[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-12 desktop:col-span-2 desktop:grid-cols-2">
      {options.map((o) => {
        const on = o.value === value;
        const Glyph = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex items-start gap-12 rounded-card border px-16 py-12 text-left transition-hover',
              on ? 'border-accent bg-accent-wash ring-1 ring-inset ring-accent/40' : 'border-edge bg-card hover:border-edge-strong hover:bg-band',
            )}
          >
            {Glyph ? (
              <span aria-hidden="true" className={cx('mt-2 flex size-control-sm shrink-0 items-center justify-center rounded-control', on ? 'bg-accent text-accent-ink' : 'bg-band text-ink-subtle')}>
                <Glyph size={16} stroke={1.5} />
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col gap-2">
              <span className={cx('text-body-sm font-medium', on ? 'text-accent-text' : 'text-ink')}>{o.title}</span>
              <span className="text-label text-ink-muted">{o.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The record's facts as they stand, in the side column: a label and a value on each line. */
export function FactList({ facts }: { facts: { label: string; value: ReactNode; muted?: boolean }[] }) {
  return (
    <dl className="flex flex-col">
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-12 border-t border-edge py-8 first:border-t-0 first:pt-0">
          <dt className="text-label text-ink-subtle">{f.label}</dt>
          <dd className={cx('min-w-0 truncate text-right text-body-sm', f.muted ? 'text-ink-subtle' : 'text-ink')}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Digits in two halves when they split evenly past four, so a code is read aloud without losing place. */
export function groupDigits(code: string): string {
  if (code.length < 6 || code.length % 2 !== 0) return code;
  return `${code.slice(0, code.length / 2)} ${code.slice(code.length / 2)}`;
}

/** A one-time secret shown once, large and spaced, with what to do with it. */
export function OneTimeCode({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-12 rounded-card bg-band px-24 py-24 text-center">
      <span className="font-mono tabular text-num-kpi text-ink">{groupDigits(code)}</span>
      <p className="measure text-body-sm text-ink-muted">{children}</p>
    </div>
  );
}
