'use client';

import { SURFACE_ROLES } from '@bliss/shared/identity';
import { ActionNode, Avatar, Eyebrow, FadeRule, GlassButton, PhotoBackdrop, VeilButton } from '@bliss/ui/components/atmosphere';
import { AtmosphereClock } from '@bliss/ui/components/atmosphere-clock';
import { AmbientConsoleArtwork } from '@bliss/ui/components/artwork/console-flow';
import { BlissWordmark } from '@bliss/ui/components/brand';
import { PinPad } from '@bliss/ui/components/pin-pad';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowLeft } from '@tabler/icons-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffPhoto } from '@/lib/pos/staff-photos';
import type { StaffSummary } from '@/modules/identity/service';
import { ROLE_LABEL } from '../(shell)/_lib/labels';
import { pinWeakness } from '@bliss/shared/pin';
import { chooseConsolePin, signInToConsole } from './actions';

const BACKDROP = '1621275471769-e6aa344546d5';

export function ConsoleSignInClient({ staff, outlet, notice }: { staff: StaffSummary[]; outlet: { name: string; timezone: string }; notice: string | null }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(notice);
  const [pending, setPending] = useState(false);
  /** After a reset or an expiry: the pass to choose a new PIN, and the step reached. */
  const [change, setChange] = useState<{ token: string; length: number; reason: 'reset' | 'expired'; first: string | null } | null>(null);
  const router = useRouter();
  const roles = SURFACE_ROLES['console'];

  const people = staff.filter((s) => roles.includes(s.roleKey)).sort((a, b) => roles.indexOf(a.roleKey) - roles.indexOf(b.roleKey) || a.displayName.localeCompare(b.displayName));
  const person = people.find((p) => p.id === chosen);
  const teamId = `console-team`;

  const choose = (id: string | null) => {
    setChosen(id);
    setPin('');
    setError(null);
    setChange(null);
  };

  const submit = async (value: string) => {
    if (!chosen) return;
    setPending(true);
    setError(null);
    const result = await signInToConsole(chosen, value);
    setPending(false);
    setPin('');
    if (result && !result.ok) setError(result.message);
    else if (result?.change) setChange({ token: result.token, length: result.length, reason: result.reason, first: null });
    // Otherwise it redirects and never reaches here.
  };

  /** Choose a new PIN: once, then again to confirm, then sign in with it. */
  const submitNew = async (value: string) => {
    if (!change) return;
    if (change.first === null) {
      const weak = pinWeakness(value);
      setPin('');
      if (weak) return setError(`That PIN is too easy to guess. ${weak}`);
      setError(null);
      return setChange({ ...change, first: value });
    }
    if (value !== change.first) {
      setPin('');
      setChange({ ...change, first: null });
      return setError('The two PINs were not the same. Start again.');
    }
    setPending(true);
    setError(null);
    const result = await chooseConsolePin(change.token, value);
    setPending(false);
    setPin('');
    if (result && !result.ok) {
      setError(result.message);
      setChange(result.restart ? null : { ...change, first: null });
    }
  };

  const length = change ? change.length : (person?.pinLength ?? 6);
  const prompt = pending
    ? change
      ? 'Saving your PIN'
      : 'Checking your PIN'
    : change
      ? change.first === null
        ? `Choose a new ${change.length} digit PIN`
        : 'Enter it once more'
      : `Enter your ${length} digit PIN`;

  return (
    <div className="relative flex h-dvh flex-col tablet:grid tablet:grid-cols-[minmax(320px,2fr)_3fr] bg-page">
      <section data-theme="dark" className="hidden tablet:flex relative min-h-[180px] tablet:min-h-0 shrink-0 tablet:shrink flex-col justify-between overflow-hidden p-24 tablet:p-40 bg-page text-ink">
        <PhotoBackdrop src={`https://images.unsplash.com/photo-${BACKDROP}?q=80&w=1200&auto=format&fit=crop`} />

        <div className="relative z-10">
          <BlissWordmark size={80} label="Bliss" />
        </div>

        <div className="relative z-10 mt-auto flex flex-col">
          <Eyebrow as="p" className="flex items-center gap-12">
            <span>{outlet.name}</span>
            <span aria-hidden="true" className="size-[2px] rounded-dot bg-ink-subtle/80" />
            <span>Console</span>
          </Eyebrow>
          <FadeRule className="my-20" />
          <AtmosphereClock timeZone={outlet.timezone} className="gap-6" />
        </div>

        <FadeRule orientation="y" className="absolute bottom-[10%] right-0 top-[10%] z-20" />
      </section>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <AmbientConsoleArtwork />
        <section className="safe-x safe-b relative z-10 flex min-h-0 flex-1 flex-col justify-between overflow-y-auto pt-16 [--bliss-gutter-b:16px] [--bliss-gutter-x:16px] pad:pt-24 pad:[--bliss-gutter-b:24px] pad:[--bliss-gutter-x:24px] tablet:pt-40 tablet:[--bliss-gutter-b:40px] tablet:[--bliss-gutter-x:40px]">
          {!person ? (
            <>
              <header className="relative z-10 flex flex-col gap-16 pad:gap-24 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-16">
                <VeilButton icon={IconArrowLeft} onClick={() => router.push('/')} className="self-end origin-right scale-90 tablet:self-start tablet:origin-top-left">
                  Back to home
                </VeilButton>

                <div className="flex flex-col items-end text-right">
                  <h1 className="font-mono text-title font-medium text-balance text-ink pad:text-title-lg tablet:text-heading">Sign in to Console</h1>
                  <p className="mt-8 tablet:mt-12 text-body text-ink-subtle">Choose your name, then enter your PIN.</p>
                </div>
              </header>

              <div className="relative z-10 mt-auto flex flex-col gap-16 pt-20 pad:pt-32">
                <div className="flex items-center justify-between">
                  <Eyebrow as="h2" id={teamId}>
                    Who is working
                  </Eyebrow>
                  <span className="font-mono tabular text-num-sm text-ink-muted">{people.length === 1 ? '1 on the team' : `${people.length} on the team`}</span>
                </div>

                <ul aria-labelledby={teamId} className="grid grid-cols-1 gap-12 pad:grid-cols-2 pad:gap-16">
                  {people.map((p) => (
                    <li key={p.id}>
                      <GlassButton onClick={() => choose(p.id)} className="flex w-full items-center gap-16">
                        <Avatar src={staffPhoto(p.displayName)} name={p.displayName} />
                        <span className="flex flex-1 flex-col justify-center gap-6">
                          <span className="text-title font-medium text-ink">{p.displayName}</span>
                          <Eyebrow size="caps" tone="muted">
                            {ROLE_LABEL[p.roleKey] ?? p.roleKey}
                          </Eyebrow>
                        </span>
                        <ActionNode shape="round" className="ml-auto" />
                      </GlassButton>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <header className="relative z-20 flex items-start justify-end tablet:justify-start">
                <VeilButton icon={IconArrowLeft} onClick={() => choose(null)} className="origin-right scale-90 tablet:origin-top-left">
                  Switch profile
                </VeilButton>
              </header>

              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                <div className="pointer-events-auto mt-32 flex w-full max-w-[340px] flex-col items-center">
                  <Avatar src={staffPhoto(person.displayName)} name={person.displayName} size="lg" className="mb-24" />
                  <h1 className="ink-sheen font-mono text-persona">{person.displayName}</h1>
                  <Eyebrow as="p" tone={pending || change ? 'accent' : 'subtle'} aria-live="polite" className={cx('mt-8', pending && 'animate-breathe', change ? 'mb-8' : 'mb-16')}>
                    {prompt}
                  </Eyebrow>
                  {change ? (
                    <p className="mb-16 text-center text-body-sm text-ink-muted">
                      {change.reason === 'expired' ? 'Your PIN has run out.' : 'A manager set this PIN for you.'} Choose one only you know. No runs, repeats or PINs you had before.
                    </p>
                  ) : null}
                  <PinPad
                    key={change ? `change-${change.first === null ? 1 : 2}` : 'sign-in'}
                    value={pin}
                    onChange={setPin}
                    onComplete={(v) => void (change ? submitNew(v) : submit(v))}
                    label={change ? (change.first === null ? 'New PIN' : 'New PIN again') : `PIN for ${person.displayName}`}
                    error={error}
                    disabled={pending}
                    length={length}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
