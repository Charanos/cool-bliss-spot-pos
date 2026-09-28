'use client';

import { SURFACE_NAME, SURFACE_ROLES, type StaffSurface } from '@bliss/shared/identity';
import { ActionNode, Avatar, Eyebrow, FadeRule, GlassButton, GlassPane, PhotoBackdrop, VeilButton } from '@bliss/ui/components/atmosphere';
import { AtmosphereClock } from '@bliss/ui/components/atmosphere-clock';
import { AmbientTerminalArtwork } from '@bliss/ui/components/artwork/frost-crystals';
import { BlissWordmark } from '@bliss/ui/components/brand';
import { InlineNotice, Skeleton } from '@bliss/ui/components/feedback';
import { PinPad } from '@bliss/ui/components/pin-pad';
import { SwitchingScreen } from '@bliss/ui/components/switching';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowLeft, IconLayoutDashboard } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useOutlet, useStaffDirectory } from '@/lib/pos/queries';
import { pinWeakness } from '@bliss/shared/pin';
import { choosePin, claimDevice, pairDevice, redeemHandoff, signIn, useDevice, useNeedsPairing, useSession } from '@/lib/pos/session';
import { useSync, wakeSync } from '@/lib/pos/sync';

const ROLE_LABEL: Record<string, string> = {
  waiter: 'Waiter',
  supervisor: 'Supervisor',
  cashier: 'Cashier',
  manager: 'Manager',
  owner: 'Owner',
  stock_controller: 'Stock controller',
};

/**
 * Photographs behind the clock, served from the app itself (public/backdrops): 960 by 1280 WebP, 50 to
 * 130KB, cached by the service worker, so a tablet shows them offline and never waits on a photo host.
 * Each surface has its own default; development can swap with ?backdrop=.
 */
const BACKDROPS = {
  bulbs: '/backdrops/bulbs.webp', // a long bar counter under Edison bulbs
  counter: '/backdrops/counter.webp', // an amber lit counter and stools
  pour: '/backdrops/pour.webp', // a bartender pouring over ice
} as const;

type BackdropKey = keyof typeof BACKDROPS;

const DEFAULT_BACKDROP: Record<StaffSurface, BackdropKey> = { floor: 'bulbs', counter: 'pour', console: 'bulbs' };

const backdropUrl = (key: BackdropKey) => BACKDROPS[key];

function useBackdrop(surface: StaffSurface): string {
  const [key, setKey] = useState<BackdropKey>(DEFAULT_BACKDROP[surface]);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const requested = new URLSearchParams(window.location.search).get('backdrop');
    if (requested && requested in BACKDROPS) setKey(requested as BackdropKey);
  }, []);
  return backdropUrl(key);
}

/**
 * Staff sign-in for a Floor or Counter device, in the atmosphere layer (docs/12): a photograph and the
 * clock on the left, the team or the PIN on the right over frost artwork. The team is filtered by the
 * roles that belong on this surface (docs/14 section 1), and the server refuses any other.
 */
export function StaffSignIn({ surface, home }: { surface: StaffSurface; home: string }) {
  const router = useRouter();
  const session = useSession();
  const device = useDevice();
  const outlet = useOutlet();
  const staff = useStaffDirectory();
  const sync = useSync();
  const needsPairing = useNeedsPairing(sync.bootstrapped);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // A newly registered device asks for its pairing code once, before the first PIN.
  const [pairing, setPairing] = useState(false);
  // After a reset or an expiry, the person chooses their own PIN: once, then again to confirm.
  const [change, setChange] = useState<{ token: string; length: number; note: string; first: string | null } | null>(null);
  const backdrop = useBackdrop(surface);
  const roles = SURFACE_ROLES[surface];

  // Arriving from another surface with a ticket: the person who switched is signed in here, replacing
  // whoever this device held, before anything else happens. Null until the address has been read.
  const [handoff, setHandoff] = useState<string | null>(null);
  const [spare, setSpare] = useState<{ id: string; label: string } | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('device');
    if (id) setSpare({ id, label: params.get('label') ?? 'This browser' });
    setHandoff(params.get('handoff') ?? '');
  }, []);
  const tried = useRef(false);
  useEffect(() => {
    if (!handoff || tried.current) return;
    if (!sync.bootstrapped && sync.link === 'synced') return;
    tried.current = true;
    setCarrying(true);
    // The ticket works once; it never stays in the address or the history.
    window.history.replaceState(null, '', window.location.pathname);
    void redeemHandoff(handoff, spare).then((result) => {
      setCarrying(false);
      if (result.ok) return router.replace(home);
      setNotice(result.message);
      setHandoff('');
    });
  }, [handoff, spare, sync.bootstrapped, sync.link, router, home]);

  useEffect(() => {
    if (session && handoff === '') router.replace(home);
  }, [session, handoff, router, home]);

  const people = (staff ?? []).filter((s) => roles.includes(s.roleKey)).sort((a, b) => roles.indexOf(a.roleKey) - roles.indexOf(b.roleKey) || a.displayName.localeCompare(b.displayName));
  const person = people.find((p) => p.id === chosen);
  const deviceWord = surface === 'floor' ? 'tablet' : 'counter';
  const teamId = `${surface}-team`;

  const choose = (id: string | null) => {
    setChosen(id);
    setPin('');
    setError(null);
    setChange(null);
  };

  const submitNew = async (value: string) => {
    if (!change) return;
    setPin('');
    if (change.first === null) {
      const weak = pinWeakness(value);
      if (weak) return setError(`That PIN is too easy to guess. ${weak}`);
      setError(null);
      return setChange({ ...change, first: value });
    }
    if (value !== change.first) {
      setChange({ ...change, first: null });
      return setError('The two PINs were not the same. Start again.');
    }
    setPending(true);
    setError(null);
    const result = await choosePin(change.token, value);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setChange(result.restart ? null : { ...change, first: null });
    }
  };

  const submit = async (value: string) => {
    if (!chosen) return;
    setPending(true);
    setError(null);
    if (pairing) {
      const paired = await pairDevice(value);
      setPending(false);
      setPin('');
      if (paired.ok) setPairing(false);
      else setError(paired.message);
      return;
    }
    const result = await signIn(chosen, value);
    setPending(false);
    if (!result.ok) {
      setPin('');
      if (result.change) {
        setError(null);
        setChange({ ...result.change, note: result.message, first: null });
        return;
      }
      if (result.pairing) setPairing(true);
      setError(result.message);
    }
  };

  const length = pairing ? 6 : change ? change.length : (person?.pinLength ?? 6);
  const prompt = pairing
    ? pending
      ? 'Checking the code'
      : 'Enter the pairing code from the Console'
    : change
      ? pending
        ? 'Saving your PIN'
        : change.first === null
          ? `Choose a new ${change.length} digit PIN`
          : 'Enter it once more'
      : pending
        ? 'Checking your PIN'
        : `Enter your ${length} digit PIN`;

  // Arriving with a ticket: the whole screen says so until it is spent, as it was on the way here.
  if (handoff) return <SwitchingScreen to={SURFACE_NAME[surface]} />;

  return (
    <div className="relative flex h-dvh flex-col tablet:grid tablet:grid-cols-[minmax(320px,2fr)_3fr] bg-page">
      {/* The photograph and the clock: a column beside the team on a wide screen, a band across the top of a tablet held upright. */}
      <section className="relative hidden shrink-0 flex-col justify-between overflow-hidden p-24 pad:flex pad:h-sign-band pad:flex-row pad:items-center tablet:h-auto tablet:shrink tablet:flex-col tablet:items-stretch tablet:p-40">
        <PhotoBackdrop src={backdrop} />

        <div className="relative z-10 pad:self-center tablet:self-auto">
          <BlissWordmark size={96} label="Cool Bliss" />
        </div>

        <div className="relative z-10 mt-auto flex flex-col pad:mt-0 tablet:mt-auto">
          <Eyebrow as="p" className="flex items-center gap-12">
            <span>{outlet?.name ?? 'Cool Bliss Spot'}</span>
            <span aria-hidden="true" className="size-[2px] rounded-dot bg-ink-subtle/80" />
            <span>{device ? device.label : `Registering this ${deviceWord}`}</span>
          </Eyebrow>
          <FadeRule className="my-20" />
          <AtmosphereClock timeZone={outlet?.timezone ?? 'Africa/Nairobi'} className="gap-6" />
        </div>

        <FadeRule orientation="y" className="absolute bottom-[10%] right-0 top-[10%] z-20 hidden tablet:block" />
      </section>

      <section className="safe-x safe-b relative flex min-h-0 flex-1 flex-col justify-between overflow-y-auto pt-16 [--bliss-gutter-b:16px] [--bliss-gutter-x:16px] pad:pt-24 pad:[--bliss-gutter-b:24px] pad:[--bliss-gutter-x:24px] tablet:pt-40 tablet:[--bliss-gutter-b:40px] tablet:[--bliss-gutter-x:40px]">
        <AmbientTerminalArtwork />
        {needsPairing && !person && !handoff && !carrying ? (
          <PairThisDevice surface={surface} onBack={() => router.push('/')} />
        ) : !person ? (
          <>
            <header className="relative z-10 flex flex-col gap-16 pad:gap-24 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-16">
              <div className="flex items-center gap-8 self-end origin-right scale-90 tablet:self-start tablet:origin-top-left">
                <VeilButton icon={IconArrowLeft} onClick={() => router.push('/')}>
                  Back to home
                </VeilButton>
                {/* A manager or owner who came from the Console, and was not signed straight in, goes back the same way. */}
                {spare ? (
                  <VeilButton icon={IconLayoutDashboard} onClick={() => router.push('/console')}>
                    Back to the Console
                  </VeilButton>
                ) : null}
              </div>

              <div className="flex flex-col items-end text-right">
                <h1 className="font-mono text-title font-medium text-balance text-ink pad:text-title-lg tablet:text-heading">Sign in to {device?.label ?? SURFACE_NAME[surface]}</h1>
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

              {notice && !carrying ? <InlineNotice tone="neutral">{notice}</InlineNotice> : null}
              {carrying && !person ? (
                <p aria-live="polite" className="animate-breathe py-24 text-center text-body text-ink-muted">
                  One moment
                </p>
              ) : null}
              <ul aria-labelledby={teamId} className={cx('grid grid-cols-1 gap-12 pad:grid-cols-2 pad:gap-16', carrying && 'hidden')}>
                {!sync.bootstrapped && people.length === 0
                  ? Array.from({ length: 4 }, (_, i) => (
                      <li key={i}>
                        <GlassPane padding="sm" className="flex items-center gap-16" aria-hidden="true">
                          <Skeleton className="size-avatar shrink-0 rounded-dot" />
                          <span className="flex flex-1 flex-col justify-center gap-8">
                            <Skeleton className="h-[20px] w-1/2 rounded-sm" />
                            <Skeleton className="h-[16px] w-1/3 rounded-sm" />
                          </span>
                          <Skeleton className="size-node shrink-0 rounded-sm" />
                        </GlassPane>
                      </li>
                    ))
                  : people.map((p) => (
                      <li key={p.id}>
                        <GlassButton onClick={() => choose(p.id)} className="flex w-full items-center gap-16">
                          <Avatar src={p.avatarUrl} name={p.displayName} />
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
              {!sync.bootstrapped && sync.link !== 'synced' ? (
                <div className="mt-12 flex items-center justify-between gap-12 rounded-sm border border-low/20 bg-low/10 px-16 py-8">
                  <p className="text-body text-low">No connection. This {deviceWord} needs the network once to fetch the menu and the team.</p>
                  <VeilButton onClick={() => wakeSync()} className="shrink-0">
                    Retry
                  </VeilButton>
                </div>
              ) : null}
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
                <Avatar src={person.avatarUrl} name={person.displayName} size="lg" className="mb-24" />
                <h1 className="ink-sheen font-mono text-persona">{person.displayName}</h1>
                <Eyebrow as="p" tone={pending || change ? 'accent' : 'subtle'} aria-live="polite" className={cx('mt-8', pending && 'animate-breathe', change ? 'mb-8' : 'mb-16')}>
                  {prompt}
                </Eyebrow>
                {change ? <p className="mb-16 text-center text-body-sm text-ink-muted">{change.note} No runs, repeats or PINs you had before.</p> : null}
                <PinPad
                  key={pairing ? 'pair' : change ? `change-${change.first === null ? 1 : 2}` : 'sign-in'}
                  value={pin}
                  onChange={setPin}
                  onComplete={(v) => void (change ? submitNew(v) : submit(v))}
                  label={pairing ? 'Pairing code for this device' : change ? (change.first === null ? 'New PIN' : 'New PIN again') : `PIN for ${person.displayName}`}
                  error={error}
                  disabled={pending}
                  length={length}
                />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The first step on a new tablet or till, before anyone can sign in: the venue registers it in the
 * Console, which shows a six-digit code, and the code is entered here. The code says which device
 * this is, so nothing needs choosing; once it matches, the team appears.
 */
function PairThisDevice({ surface, onBack }: { surface: StaffSurface; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thing = surface === 'floor' ? 'tablet' : 'counter';
  const submit = async (value: string) => {
    setPending(true);
    setError(null);
    const result = await claimDevice(value);
    setPending(false);
    setCode('');
    if (!result.ok) setError(result.message);
  };
  return (
    <>
      <header className="relative z-20 flex items-start justify-end tablet:justify-start">
        <VeilButton icon={IconArrowLeft} onClick={onBack} className="origin-right scale-90 tablet:origin-top-left">
          Back to home
        </VeilButton>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[380px] flex-1 flex-col items-center justify-center py-32">
        <h1 className="font-mono text-title-lg font-medium text-ink tablet:text-heading">Pair this {thing}</h1>
        <p className="mt-12 text-center text-body text-ink-muted">Once, before anyone signs in. The code tells the {thing} which one it is.</p>

        <ol className="mt-24 flex w-full flex-col gap-12 text-body-sm text-ink-subtle">
          <li className="flex gap-12">
            <span className="font-mono tabular text-accent-text">1</span>
            <span>
              In the Console, open <span className="text-ink">Settings, Devices</span> and register this {thing} as a {SURFACE_NAME[surface]} device. For one already listed, choose{' '}
              <span className="text-ink">A new pairing code</span>.
            </span>
          </li>
          <li className="flex gap-12">
            <span className="font-mono tabular text-accent-text">2</span>
            <span>Enter the six-digit code it shows. It works for 24 hours.</span>
          </li>
        </ol>

        <Eyebrow as="p" tone={pending ? 'accent' : 'subtle'} aria-live="polite" className={cx('mb-16 mt-32', pending && 'animate-breathe')}>
          {pending ? 'Checking the code' : 'Pairing code'}
        </Eyebrow>
        <PinPad value={code} onChange={setCode} onComplete={(v) => void submit(v)} label={`Pairing code for this ${thing}`} error={error} disabled={pending} length={6} />
      </div>
    </>
  );
}
