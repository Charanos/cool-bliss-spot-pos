'use client';

import { SURFACE_NAME, SURFACE_ROLES, type StaffSurface } from '@bliss/shared/identity';
import { ActionNode, Avatar, Eyebrow, FadeRule, GlassButton, GlassPane, PhotoBackdrop, VeilButton } from '@bliss/ui/components/atmosphere';
import { AtmosphereClock } from '@bliss/ui/components/atmosphere-clock';
import { AmbientTerminalArtwork } from '@bliss/ui/components/artwork/frost-crystals';
import { BlissWordmark } from '@bliss/ui/components/brand';
import { Skeleton } from '@bliss/ui/components/feedback';
import { PinPad } from '@bliss/ui/components/pin-pad';
import { cx } from '@bliss/ui/lib/cx';
import { IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useOutlet, useStaffDirectory } from '@/lib/pos/queries';
import { signIn, useDevice, useSession } from '@/lib/pos/session';
import { staffPhoto } from '@/lib/pos/staff-photos';
import { useSync, wakeSync } from '@/lib/pos/sync';

const ROLE_LABEL: Record<string, string> = {
  waiter: 'Waiter',
  supervisor: 'Supervisor',
  cashier: 'Cashier',
  manager: 'Manager',
  owner: 'Owner',
  stock_controller: 'Stock controller',
};

/** Photographs behind the clock. Each surface has its own default; development can swap with ?backdrop=. */
const BACKDROPS = {
  bulbs: '1543007630-9710e4a00a20', // a long bar counter under Edison bulbs, portrait
  counter: '1572116469696-31de0f17cc34', // an amber lit counter and stools
  pour: '1566417713940-fe7c737a9ef2', // a bartender pouring over ice
  cocktails: '1551024709-8f23befc6f87', // two cocktails, the revamp's original
} as const;

type BackdropKey = keyof typeof BACKDROPS;

const DEFAULT_BACKDROP: Record<StaffSurface, BackdropKey> = { floor: 'bulbs', counter: 'pour', console: 'bulbs' };

const backdropUrl = (key: BackdropKey) => `https://images.unsplash.com/photo-${BACKDROPS[key]}?q=80&w=1200&auto=format&fit=crop`;

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
  const [chosen, setChosen] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const backdrop = useBackdrop(surface);
  const roles = SURFACE_ROLES[surface];

  useEffect(() => {
    if (session) router.replace(home);
  }, [session, router, home]);

  const people = (staff ?? [])
    .filter((s) => roles.includes(s.roleKey))
    .sort((a, b) => roles.indexOf(a.roleKey) - roles.indexOf(b.roleKey) || a.displayName.localeCompare(b.displayName));
  const person = people.find((p) => p.id === chosen);
  const deviceWord = surface === 'floor' ? 'tablet' : 'counter';
  const teamId = `${surface}-team`;

  const choose = (id: string | null) => {
    setChosen(id);
    setPin('');
    setError(null);
  };

  const submit = async (value: string) => {
    if (!chosen) return;
    setPending(true);
    setError(null);
    const result = await signIn(chosen, value);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setPin('');
    }
  };

  return (
    <div className="relative flex h-dvh flex-col tablet:grid tablet:grid-cols-[minmax(320px,2fr)_3fr] bg-page">
      <section className="hidden tablet:flex relative min-h-[180px] tablet:min-h-0 shrink-0 tablet:shrink flex-col justify-between overflow-hidden p-24 tablet:p-40">
        <PhotoBackdrop src={backdrop} />

        <div className="relative z-10">
          <BlissWordmark size={80} label="Bliss" />
        </div>

        <div className="relative z-10 mt-auto flex flex-col">
          <Eyebrow as="p" className="flex items-center gap-12">
            <span>{outlet?.name ?? 'Cool Bliss Spot'}</span>
            <span aria-hidden="true" className="size-[2px] rounded-dot bg-ink-subtle/80" />
            <span>{device ? device.label : `Registering this ${deviceWord}`}</span>
          </Eyebrow>
          <FadeRule className="my-20" />
          <AtmosphereClock timeZone={outlet?.timezone ?? 'Africa/Nairobi'} className="gap-6" />
        </div>

        <FadeRule orientation="y" className="absolute bottom-[10%] right-0 top-[10%] z-20" />
      </section>

      <section className="safe-x safe-b relative flex min-h-0 flex-1 flex-col justify-between overflow-y-auto pt-16 [--bliss-gutter-b:16px] [--bliss-gutter-x:16px] pad:pt-24 pad:[--bliss-gutter-b:24px] pad:[--bliss-gutter-x:24px] tablet:pt-40 tablet:[--bliss-gutter-b:40px] tablet:[--bliss-gutter-x:40px]">
        <AmbientTerminalArtwork />
        {!person ? (
          <>
            <header className="relative z-10 flex flex-col gap-16 pad:gap-24 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-16">
              <VeilButton 
                icon={IconArrowLeft} 
                onClick={() => router.push('/')} 
                className="self-end origin-right scale-90 tablet:self-start tablet:origin-top-left"
              >
                Back to home
              </VeilButton>
              
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

              <ul aria-labelledby={teamId} className="grid grid-cols-1 gap-12 pad:grid-cols-2 pad:gap-16">
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
              {!sync.bootstrapped && sync.link !== 'synced' ? (
                <div className="mt-12 flex items-center justify-between gap-12 rounded-sm border border-low/20 bg-low/10 px-16 py-8">
                  <p className="text-body text-low">
                    No connection. This {deviceWord} needs the network once to fetch the menu and the team.
                  </p>
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
              <VeilButton 
                icon={IconArrowLeft} 
                onClick={() => choose(null)}
                className="origin-right scale-90 tablet:origin-top-left"
              >
                Switch profile
              </VeilButton>
            </header>

            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="pointer-events-auto mt-32 flex w-full max-w-[340px] flex-col items-center">
                <Avatar src={staffPhoto(person.displayName)} name={person.displayName} size="lg" className="mb-24" />
                <h1 className="ink-sheen font-mono text-persona">{person.displayName}</h1>
                <Eyebrow as="p" tone={pending ? 'accent' : 'subtle'} aria-live="polite" className={cx('mb-16 mt-8', pending && 'animate-breathe')}>
                  {pending ? 'Checking your PIN' : 'Enter your 6 digit PIN'}
                </Eyebrow>
                <PinPad value={pin} onChange={setPin} onComplete={(v) => void submit(v)} label={`PIN for ${person.displayName}`} error={error} disabled={pending} />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
