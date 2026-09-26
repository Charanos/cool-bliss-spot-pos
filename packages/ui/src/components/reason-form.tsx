'use client';

import { REASON_MIN_LENGTH, REASON_TOO_SHORT, applyQuickReason, checkReason, reasonLength } from '@bliss/shared/reason';
import { type ReactNode, useId, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { Button } from './button';
import { TextArea } from './fields';
import { OverlayActions } from './overlay';
import { PinPad } from './pin-pad';

export interface ReasonSubmit {
  reason: string;
  approverPin: string | null;
}

export interface ReasonFormProps {
  quickReasons: readonly string[];
  initialReason?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Where approval is needed, the approver enters their own PIN inside the dialog. */
  approval?: { label: string } | null;
  children?: ReactNode;
  /** Floor focuses a chip so the keyboard does not cover the dialog; Console focuses the field. */
  focus?: 'chip' | 'field';
  onCancel: () => void;
  /** Throw an Error with a plain sentence to show it inline. */
  onConfirm: (input: ReasonSubmit) => Promise<void> | void;
}

/**
 * The one reason dialog body, for every void, discount, write-off, hold, override and adjustment.
 * docs/06-design-system.md section 6.7 and docs/08-ux-copy.md section 8.
 *
 * Quick chips populate the field rather than replacing it, and a chip alone is never accepted.
 * There is no shared supervisor password: an approver types their own PIN here.
 */
export function ReasonForm({ quickReasons, initialReason = '', confirmLabel, cancelLabel = 'Keep it', destructive = true, approval, children, focus = 'field', onCancel, onConfirm }: ReasonFormProps) {
  const [reason, setReason] = useState(initialReason);
  const [pin, setPin] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const formId = useId();

  const length = reasonLength(reason);
  const check = checkReason(reason);
  const needsPin = Boolean(approval);
  // An approver's PIN is four to eight digits; the pad does not know whose it will be.
  const pinReady = !needsPin || pin.length >= 4;

  const submit = async () => {
    setAttempted(true);
    setFailure(null);
    if (!check.ok || !pinReady) {
      if (!check.ok) fieldRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      await onConfirm({ reason: check.reason, approverPin: needsPin ? pin : null });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'That did not go through. Nothing was changed.');
      if (needsPin) setPin('');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col"
    >
      {children}
      <div className="flex flex-wrap gap-8" role="group" aria-label="Common reasons">
        {quickReasons.map((chip, i) => (
          <button
            key={chip}
            type="button"
            data-autofocus={focus === 'chip' && i === 0 ? '' : undefined}
            onClick={() => {
              setReason((current) => applyQuickReason(current, chip));
              requestAnimationFrame(() => {
                const el = fieldRef.current;
                if (el && focus === 'field') {
                  el.focus();
                  el.setSelectionRange(el.value.length, el.value.length);
                }
              });
            }}
            className="inline-flex h-control-md items-center rounded-sm bg-control px-12 text-body-sm text-ink press-feedback hover:bg-control-hover"
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="pt-16">
        <TextArea
          ref={fieldRef}
          data-autofocus={focus === 'field' ? '' : undefined}
          label="Reason (at least 10 characters)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={280}
          rows={2}
          error={attempted && !check.ok ? REASON_TOO_SHORT : undefined}
          counter={length < REASON_MIN_LENGTH ? `${length}/${REASON_MIN_LENGTH}` : String(length)}
        />
      </div>

      {approval ? (
        <div className="pt-24">
          <p className="pb-16 text-label text-ink-subtle">{approval.label}</p>
          <PinPad value={pin} onChange={setPin} label={approval.label} size="md" length={8} error={attempted && !pinReady ? "Enter the approver's PIN, four to eight digits." : null} />
        </div>
      ) : null}

      {failure ? (
        <p role="alert" className="pt-16 text-body text-stop">
          {failure}
        </p>
      ) : null}

      <OverlayActions className={cx(destructive && 'justify-between')}>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant={destructive ? 'destructive' : 'primary'} size="lg" loading={pending} disabled={attempted && (!check.ok || !pinReady)}>
          {confirmLabel}
        </Button>
      </OverlayActions>
    </form>
  );
}
