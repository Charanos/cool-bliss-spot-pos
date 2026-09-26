'use client';

import { PIN_MAX, PIN_MIN, pinWeakness } from '@bliss/shared/pin';
import { formatDate } from '@bliss/shared/format';
import { Button } from '@bliss/ui/components/button';
import { Segmented } from '@bliss/ui/components/choice';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { PinBoxes } from '@bliss/ui/components/console/pin-boxes';
import { useToast } from '@bliss/ui/components/console/toast';
import { SelectField, Stepper, Switch, TextField } from '@bliss/ui/components/fields';
import { ReasonForm } from '@bliss/ui/components/reason-form';
import { cx } from '@bliss/ui/lib/cx';
import { IconCheck, IconCircle, IconCopy, IconRefresh, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setPin } from '../../_actions/people';
import { OneTimeCode } from '../../_components/forms';

export interface PinPolicyView {
  length: number;
  expiryDays: number | null;
  ownPinAfterReset: boolean;
}

export interface PinTarget {
  id: string;
  displayName: string;
  hasPin: boolean;
}

type Mode = 'typed' | 'generated';
type Expiry = 'never' | '30' | '60' | '90' | '180' | 'date';

const DAY = 24 * 60 * 60_000;

const EXPIRY_OPTIONS: { value: Expiry; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: '30', label: 'In 30 days' },
  { value: '60', label: 'In 60 days' },
  { value: '90', label: 'In 90 days' },
  { value: '180', label: 'In 180 days' },
  { value: 'date', label: 'On a date' },
];

/** A PIN made in the browser, from the platform's secure random source, that passes every rule. */
function randomPin(length: number): string {
  const bytes = new Uint32Array(length);
  for (let tries = 0; tries < 100; tries += 1) {
    crypto.getRandomValues(bytes);
    const pin = Array.from(bytes, (b) => String(b % 10)).join('');
    if (!pinWeakness(pin)) return pin;
  }
  return '';
}

function expiryFrom(policyDays: number | null): Expiry {
  if (policyDays === null) return 'never';
  const match = EXPIRY_OPTIONS.find((o) => o.value === String(policyDays));
  return match ? match.value : 'never';
}

function isoDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * Set or reset someone's PIN. The manager types one (boxes that take a paste) or has one made at
 * random, chooses how many digits and how long it lasts, and whether the person must choose their
 * own at the next sign-in. A made PIN is shown before saving and once more after, to hand over.
 */
export function PinDialog({ target, policy, timezone, onClose }: { target: PinTarget | null; policy: PinPolicyView; timezone: string; onClose: () => void }) {
  const router = useRouter();
  const notify = useToast();
  const [mode, setMode] = useState<Mode>('generated');
  const [length, setLength] = useState(policy.length);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [made, setMade] = useState('');
  const [expiry, setExpiry] = useState<Expiry>(expiryFrom(policy.expiryDays));
  const [date, setDate] = useState('');
  const [mustChange, setMustChange] = useState(policy.ownPinAfterReset);
  const [copied, setCopied] = useState(false);
  const [handover, setHandover] = useState<{ pin: string; expiresAt: number | null; mustChange: boolean } | null>(null);

  useEffect(() => {
    if (!target) return;
    setMode('generated');
    setLength(policy.length);
    setPinValue('');
    setConfirm('');
    setMade(randomPin(policy.length));
    setExpiry(expiryFrom(policy.expiryDays));
    setDate(isoDay(Date.now() + 90 * DAY));
    setMustChange(policy.ownPinAfterReset);
    setCopied(false);
    setHandover(null);
    // Reset only when the dialog opens for someone: a refresh behind it must not wipe the form or the hand-over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const changeLength = (next: number) => {
    setLength(next);
    setPinValue((p) => p.slice(0, next));
    setConfirm((c) => c.slice(0, next));
    setMade(randomPin(next));
    setCopied(false);
  };

  const weak = pin.length === length ? pinWeakness(pin) : null;
  type Rule = { state: 'ok' | 'bad' | 'open'; label: string };
  const full = pin.length === length;
  const rules: Rule[] = [
    { state: full ? 'ok' : 'open', label: `${length} digits` },
    { state: !full ? 'open' : weak ? 'bad' : 'ok', label: weak ? weak.replace(/\.$/, '') : 'Not a run, a repeat or a common PIN' },
    { state: !full || confirm.length < length ? 'open' : confirm === pin ? 'ok' : 'bad', label: 'Typed the same twice' },
  ];

  const days = (): number | null => {
    if (expiry === 'never') return null;
    if (expiry !== 'date') return Number(expiry);
    const at = Date.parse(`${date}T23:59:59`);
    return Number.isFinite(at) ? Math.max(1, Math.ceil((at - Date.now()) / DAY)) : null;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handover?.pin ?? made);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const finish = () => {
    const name = target?.displayName ?? 'Their';
    onClose();
    notify({ title: `${name}'s PIN ${target?.hasPin ? 'reset' : 'set'}`, body: handover?.mustChange ? 'They choose their own at the next sign-in.' : 'Their old sessions have ended.' });
    router.refresh();
  };

  const title = handover ? `Hand this to ${target?.displayName ?? 'them'}` : target ? `${target.hasPin ? 'Reset' : 'Set'} ${target.displayName}'s PIN` : '';
  const description = handover
    ? 'Shown once. Nobody, you included, can see it again.'
    : target?.hasPin
      ? 'Their current PIN stops working and every session they have ends.'
      : 'They can sign in on the Floor, the Counter or the Console once it is set.';

  return (
    <ConsoleOverlay open={Boolean(target)} onClose={handover ? finish : onClose} title={title} description={description} width="lg">
      {target && handover ? (
        <div className="flex flex-col gap-24">
          <OneTimeCode code={handover.pin}>
            {handover.mustChange ? 'It works for their next sign-in, then they choose their own.' : 'They sign in with it on any station.'}{' '}
            {handover.expiresAt ? `It runs out on ${formatDate(handover.expiresAt, timezone)}.` : 'It does not run out.'}
          </OneTimeCode>
          <div className="flex items-center justify-between gap-12 border-t border-rule pt-16">
            <Button variant="ghost" icon={copied ? IconCheck : IconCopy} onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="primary" onClick={finish}>
              Done
            </Button>
          </div>
        </div>
      ) : target ? (
        <ReasonForm
          key={target.id}
          destructive={false}
          quickReasons={target.hasPin ? ['Forgot their PIN', 'PIN was shared', 'Regular change'] : ['New starter', 'First PIN']}
          confirmLabel={target.hasPin ? 'Reset the PIN' : 'Set the PIN'}
          onCancel={onClose}
          onConfirm={async ({ reason }) => {
            if (mode === 'typed') {
              if (pin.length !== length) throw new Error(`Enter all ${length} digits.`);
              if (weak) throw new Error(`That PIN is too easy to guess. ${weak}`);
              if (confirm !== pin) throw new Error('The two PINs are not the same.');
            }
            if (expiry === 'date' && days() === null) throw new Error('Choose the day it runs out.');
            const chosen = mode === 'typed' ? pin : made;
            const result = await setPin({ staffId: target.id, mode, pin: chosen || null, length, expiresInDays: days(), mustChange, reason });
            if (!result.ok) throw new Error(result.message);
            if (mode === 'generated' && result.pin) {
              setCopied(false);
              setHandover({ pin: result.pin, expiresAt: result.expiresAt, mustChange });
              return;
            }
            onClose();
            notify({ title: `${target.displayName}'s PIN ${target.hasPin ? 'reset' : 'set'}`, body: mustChange ? 'They choose their own at the next sign-in.' : 'Their old sessions have ended.' });
            router.refresh();
          }}
        >
          <div className="flex flex-col gap-24 pb-16">
            <div className="flex flex-wrap items-end justify-between gap-16">
              <div className="flex flex-col gap-8">
                <span className="text-label text-ink-muted">How</span>
                <Segmented
                  label="How the PIN is chosen"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'generated', label: 'Make one at random' },
                    { value: 'typed', label: 'Type one' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-8">
                <span className="text-label text-ink-muted">Digits</span>
                <Stepper value={length} min={PIN_MIN} max={PIN_MAX} onChange={changeLength} label="Digits in the PIN" size="md" decreaseLabel="Fewer digits" increaseLabel="More digits" />
              </div>
            </div>

            {mode === 'generated' ? (
              <div className="flex flex-col items-center gap-16 rounded-card bg-band px-24 py-24">
                <span className="font-mono tabular text-num-kpi text-ink" aria-live="polite">
                  {made.length > 0 ? made.split('').join(' ') : 'Could not make one'}
                </span>
                <div className="flex flex-wrap justify-center gap-8">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={IconRefresh}
                    onClick={() => {
                      setMade(randomPin(length));
                      setCopied(false);
                    }}
                  >
                    Make another
                  </Button>
                  <Button variant="ghost" size="sm" icon={copied ? IconCheck : IconCopy} onClick={() => void copy()} disabled={!made}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="measure text-center text-body-sm text-ink-muted">Shown again after saving, so you can hand it over. It is never stored where anyone can read it.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-16">
                <div className="flex flex-wrap gap-24">
                  <PinBoxes label="New PIN" value={pin} onChange={setPinValue} length={length} helper="Type it, or paste it in." focusFirst />
                  <PinBoxes
                    label="Once more"
                    value={confirm}
                    onChange={setConfirm}
                    length={length}
                    revealable={false}
                    error={confirm.length === length && confirm !== pin ? 'Not the same as above.' : null}
                  />
                </div>
                <ul className="flex flex-col gap-4" aria-label="PIN rules">
                  {rules.map((r) => (
                    <li key={r.label} className={cx('flex items-center gap-8 text-body-sm', r.state === 'ok' ? 'text-poured' : r.state === 'bad' ? 'text-stop' : 'text-ink-subtle')}>
                      {r.state === 'ok' ? (
                        <IconCheck size={14} stroke={2} aria-hidden="true" />
                      ) : r.state === 'bad' ? (
                        <IconX size={14} stroke={2} aria-hidden="true" />
                      ) : (
                        <IconCircle size={14} stroke={1.5} aria-hidden="true" />
                      )}
                      {r.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-8 text-body-sm text-ink-subtle">
                    <IconCircle size={14} stroke={1.5} aria-hidden="true" />
                    Not one they had before, checked when you save
                  </li>
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-16 border-t border-rule pt-16 desktop:grid-cols-2">
              <SelectField
                label="Runs out"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as Expiry)}
                options={EXPIRY_OPTIONS}
                helper={policy.expiryDays ? `The outlet's rule is ${policy.expiryDays} days.` : 'The outlet has no expiry rule.'}
              />
              {expiry === 'date' ? <TextField label="Last day it works" type="date" value={date} min={isoDay(Date.now() + DAY)} onChange={(e) => setDate(e.target.value)} required /> : null}
            </div>
            <Switch checked={mustChange} onChange={setMustChange} label="They choose their own at the next sign-in" helper="This PIN works once. Then they pick one only they know." />
          </div>
        </ReasonForm>
      ) : null}
    </ConsoleOverlay>
  );
}
