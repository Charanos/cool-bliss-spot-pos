import { formatDate, plural } from '@bliss/shared/format';
import { zonedParts } from '@bliss/shared/time';
import { ActionNode, Eyebrow, GlassLink } from '@bliss/ui/components/atmosphere';
import { AmbientBarArtwork } from '@bliss/ui/components/artwork/bar-glassware';
import { Badge } from '@bliss/ui/components/badge';
import { BlissMark } from '@bliss/ui/components/brand';
import { SeatChipStack } from '@bliss/ui/components/working';
import { Dot } from '@bliss/ui/components/status';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { fresh } from '@/modules/_data/store';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import { cx } from '@/packages/ui/src/lib/cx';

/** Live figures on every request: a cached landing page would show yesterday's floor. */
export const dynamic = 'force-dynamic';

/**
 * The entry: two surfaces, one sentence about why Bliss exists. Composed from the atmosphere layer,
 * docs/12-surface-language.md.
 *
 * The telemetry strips are real and deliberately not financial. This page sits in front of sign-in,
 * so it may say how busy the floor is, but takings and variance stay behind the Console's session.
 */
/**
 * The greeting the door staff would give, by the hour in Nairobi. Swahili for the hello, English for
 * the question, the way people at the venue actually speak. Marked lang="sw" for screen readers.
 */
function greeting(at: number, timeZone: string) {
  const { hour } = zonedParts(at, timeZone);
  if (hour >= 5 && hour < 12) return { hello: 'Habari ya asubuhi', ask: 'where are you working today?' };
  if (hour >= 12 && hour < 16) return { hello: 'Habari ya mchana', ask: 'where are you working today?' };
  return { hello: 'Habari ya jioni', ask: 'where are you working tonight?' };
}

export default async function EntryPage() {
  await fresh();
  const outlet = identity.outlet();
  const now = Date.now();
  const { hello, ask } = greeting(now, outlet.timezone);
  const open = trade.openTabs();
  const seatsOnFloor = open.reduce((max, t) => Math.max(max, t.seats.filter((s) => s.status === 'active').length), 0);

  return (
    <>
      <AmbientBarArtwork />

      <main className="mx-auto flex min-h-dvh max-w-[1040px] flex-col justify-between px-16 py-24 tablet:px-32 tablet:py-56">
        <header className="flex items-center justify-between">
          <BlissMark size={64} label="Bliss" />
        </header>

        <section aria-labelledby="entry-title" className="my-auto py-32 tablet:py-40">
          <div className="mb-40">
            <Eyebrow as="p" className="mb-20">
              {outlet.name} · {formatDate(now, outlet.timezone)}
            </Eyebrow>
            <h1 id="entry-title" className="max-w-full text-title-lg tablet:text-display">
              <span lang="sw" className="block text-ink">
                {hello}{', '}<span className="text-ink-muted">{ask}</span>
              </span>
            </h1>
            <p className="mt-16 tablet:mt-20 max-w-[54ch] text-body tablet:text-body-lg text-ink-muted">Every order is kept by the seat, so the bill, the bar and the stock always agree.</p>
          </div>

          <ul className="grid grid-cols-1 gap-24 tablet:grid-cols-2">
            <li>
              <SurfaceCard
                href="/floor"
                emphasis="accent"
                badge={<Badge tone="accent">Waiter tablet</Badge>}
                title="Floor"
                body="Take orders by the seat and send them straight to the bar."
                telemetry={
                  open.length === 0 ? (
                    <span className="flex items-center gap-8">
                      <Dot tone="neutral" />
                      <Eyebrow size="caps" tone="muted">
                        No tabs open
                      </Eyebrow>
                    </span>
                  ) : (
                    <span className="flex items-center gap-6">
                      <SeatChipStack 
                        seats={Array.from({ length: Math.min(Math.max(seatsOnFloor, 1), 6) }, (_, i) => ({ seatNo: i + 1 }))} 
                        size="dense" 
                        overlapping 
                      />
                      <Eyebrow size="caps" tone="muted" className="ml-2">
                        {`${plural(open.length, 'tab')} open`}
                      </Eyebrow>
                    </span>
                  )
                }
              />
            </li>
            <li>
              <SurfaceCard
                href="/counter"
                emphasis="attention"
                badge={<Badge tone="attention">Counter register</Badge>}
                title="Counter"
                body="Take walk-up orders, manage the drawer, and serve counter guests."
                telemetry={
                  <span className="flex items-center gap-8">
                    <Dot tone="poured" />
                    <Eyebrow size="caps" tone="poured">
                      Ready for service
                    </Eyebrow>
                  </span>
                }
              />
            </li>
          </ul>
        </section>

        {/* The Console is not a station anyone stands at, so it is a line, not a third card. */}
        <p className="mt-24 text-body text-ink-muted">
          Managing Cool Bliss Spot?{' '}
          <Link href="/console" className="text-ink underline decoration-rule-raised underline-offset-4 press-feedback hover:decoration-accent">
            Open the Console
          </Link>
          , on a desktop.
        </p>

        <footer className="mt-24 flex flex-wrap items-center justify-between gap-12 border-t border-hairline/40 pt-20 text-micro uppercase text-ink-subtle">
          <span>Cool Bliss Spot · Nairobi</span>
          <span>Floor and Counter</span>
        </footer>
      </main>
    </>
  );
}

/** One entry point: what it is, what it does, and a live line proving it is running. */
function SurfaceCard({ href, badge, title, body, telemetry, emphasis }: { href: string; badge: ReactNode; title: string; body: string; telemetry: ReactNode; emphasis?: 'accent' | 'attention' }) {
  const emphasisClasses = emphasis === 'accent'
    ? 'shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-accent)_15%,transparent),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.03)] texture-dots-accent !bg-accent-wash border-accent/20'
    : emphasis === 'attention'
      ? 'shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--color-stop)_15%,transparent),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.03)] texture-dots-stop !bg-stop-wash border-stop/20'
      : '';

  return (
    <GlassLink href={href} className={cx("flex min-h-[220px] flex-col justify-between tablet:min-h-[240px]", emphasisClasses)}>
      <span className="relative z-10 flex items-center justify-between">
        {badge}
        <ActionNode />
      </span>
      <span className="relative z-10 my-auto block py-16">
        <span className="block text-title tablet:text-heading font-medium text-ink">{title}</span>
        <span className="mt-8 block text-body-sm text-ink-muted">{body}</span>
      </span>
      <span className="relative z-10 flex items-center justify-between pt-8">{telemetry}</span>
    </GlassLink>
  );
}
