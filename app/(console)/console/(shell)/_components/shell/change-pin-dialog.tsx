'use client';

import { pinWeakness } from '@bliss/shared/pin';
import { Button } from '@bliss/ui/components/button';
import { ConsoleOverlay } from '@bliss/ui/components/console/dialog';
import { PinBoxes } from '@bliss/ui/components/console/pin-boxes';
import { useToast } from '@bliss/ui/components/console/toast';
import { InlineNotice } from '@bliss/ui/components/feedback';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState, useTransition } from 'react';
import { changeOwnPin } from '../../_actions/people';

/**
 * Change your own PIN, with the one you have now. Every other session you have ends; this browser
 * stays signed in with the new PIN.
 */
export function ChangePinDialog({ open, onClose, currentLength, nextLength }: { open: boolean; onClose: () => void; currentLength: number; nextLength: number }) {
  const router = useRouter();
  const notify = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setAgain('');
    setError('');
  }, [open]);

  const weak = next.length === nextLength ? pinWeakness(next) : null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (current.length !== currentLength) return setError(`Enter your current ${currentLength} digit PIN.`);
    if (next.length !== nextLength) return setError(`Your new PIN needs ${nextLength} digits.`);
    if (weak) return setError(`That PIN is too easy to guess. ${weak}`);
    if (again !== next) return setError('The new PIN and the one typed again are not the same.');
    start(async () => {
      const result = await changeOwnPin({ current, next });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      notify({ title: 'Your PIN changed', body: 'Use it from now on. Your other sessions have ended.' });
      router.refresh();
    });
  };

  return (
    <ConsoleOverlay open={open} onClose={onClose} title="Change my PIN" description="Your other sessions end. This one carries on with the new PIN." width="md">
      {open ? (
        <form onSubmit={save} className="flex flex-col gap-24">
          {error ? <InlineNotice tone="stop">{error}</InlineNotice> : null}
          <PinBoxes label="Current PIN" value={current} onChange={setCurrent} length={currentLength} focusFirst />
          <div className="flex flex-col gap-16 border-t border-rule pt-16">
            <PinBoxes label="New PIN" value={next} onChange={setNext} length={nextLength} error={weak ? `Too easy to guess. ${weak}` : null} helper="No runs, repeats or PINs you had before." />
            <PinBoxes
              label="New PIN again"
              value={again}
              onChange={setAgain}
              length={nextLength}
              revealable={false}
              error={again.length === nextLength && again !== next ? 'Not the same as above.' : null}
            />
          </div>
          <div className="flex justify-end gap-12 border-t border-rule pt-16">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Change my PIN
            </Button>
          </div>
        </form>
      ) : null}
    </ConsoleOverlay>
  );
}
