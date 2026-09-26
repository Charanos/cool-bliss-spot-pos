'use client';

import { formatAgo, formatDateTime, formatIsoDate } from '@bliss/shared/format';
import { addDays } from '@bliss/shared/time';
import { Button } from '@bliss/ui/components/button';
import { Card, CardFooter, CardHeader, CardMedia, CardStats, Stat } from '@bliss/ui/components/console/card';
import { CountUp, Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { LedgerItem, LedgerList } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
import { SelectField, TextField } from '@bliss/ui/components/fields';
import { useNow } from '@bliss/ui/hooks';
import { IconCalendarEvent, IconCalendarTime, IconHistory, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { assetUrl } from '@/lib/assets';
import { updateHold } from '../../_actions/inventory';
import { HoldDialog, ReleaseHoldDialog } from '../../_components/dialogs';
import { EntityLink } from '../../_components/entity-link';
import { FormDialog, useDialog } from '../../_components/forms';

interface ActiveHold {
  id: string;
  variantId: string;
  product: string;
  productId: string | null;
  imageKey: string | null;
  variant: string;
  placedBy: string;
  placedAt: number;
  reason: string;
  expectedBack: string | null;
}

interface ReleasedHold {
  id: string;
  variant: string;
  reason: string;
  releaseNote: string | null;
  releasedBy: string;
  placedAt: number;
  releasedAt: number;
}

/** How long, in the unit a manager thinks in: minutes, hours, then days. */
function since(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return formatAgo(ms);
  if (hours < 24) return `${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** What the floor cannot sell, and why: each hold as a card, and the ones lifted lately. */
export function HoldsView({ active, released, holdable, timezone, today }: { active: ActiveHold[]; released: ReleasedHold[]; holdable: { value: string; label: string }[]; timezone: string; today: string }) {
  const now = useNow(60_000);
  const [pick, setPick] = useState('');
  const [hold, setHold] = useState<{ variantId: string; name: string } | null>(null);
  const [release, setRelease] = useState<{ holdId: string; name: string } | null>(null);
  const dialog = useDialog<'date', ActiveHold | null>();
  const overdue = active.filter((h) => h.expectedBack && h.expectedBack < today);
  const thisWeek = active.filter((h) => h.expectedBack && h.expectedBack >= today && h.expectedBack <= addDays(today, 7));

  return (
    <div className="flex flex-col gap-32">
      <MetricGrid>
        <Metric label="On hold" icon={IconLock} tone={active.length > 0 ? 'attention' : 'default'} value={<CountUp value={active.length} />} detail={active.length > 0 ? 'The floor cannot sell these' : 'The floor can sell everything'} />
        <Metric label="Overdue" icon={IconCalendarTime} tone={overdue.length > 0 ? 'stop' : 'default'} value={<CountUp value={overdue.length} delayMs={60} />} detail={overdue.length > 0 ? 'Past the day they were due back' : 'None past their date'} />
        <Metric label="Back this week" icon={IconCalendarEvent} value={<CountUp value={thisWeek.length} delayMs={120} />} detail="Expected in the next seven days" />
        <Metric label="Lifted lately" icon={IconHistory} value={<CountUp value={released.length} delayMs={180} />} detail="The last ten taken off hold" />
      </MetricGrid>

      <div className="flex flex-wrap items-end gap-8">
        <SelectField label="Put an item on hold" value={pick} onChange={(e) => setPick(e.target.value)} options={[{ value: '', label: 'Choose an item' }, ...holdable]} className="w-search" />
        <Button variant="create" icon={IconLock} disabled={!pick} onClick={() => setHold({ variantId: pick, name: holdable.find((h) => h.value === pick)?.label ?? '' })}>
          Put on hold
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="Nothing is on hold" body="Everything the ledger says you have, the floor can sell." />
      ) : (
        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
          {active.map((h) => {
            const late = Boolean(h.expectedBack && h.expectedBack < today);
            return (
              <Card key={h.id} as="article" className="group h-full" tone={late ? 'stop' : 'low'}>
                <CardMedia src={assetUrl(h.imageKey, 640, 320)} title={h.variant} subtitle={h.product} href={h.productId ? `/console/catalogue/products/${h.productId}` : undefined} />
                <CardStats columns={2}>
                  <Stat label="On hold for">{since(now - h.placedAt)}</Stat>
                  <Stat label="Back" tone={late ? 'stop' : undefined}>
                    {h.expectedBack ? formatIsoDate(h.expectedBack) : 'Not given'}
                  </Stat>
                </CardStats>
                <p className="px-20 pb-16 text-body-sm text-ink-muted">
                  {h.reason}
                  <span className="block text-ink-subtle">
                    {h.placedBy}, {formatDateTime(h.placedAt, timezone)}
                  </span>
                </p>
                <CardFooter>
                  <Button size="sm" variant="ghost" icon={IconCalendarEvent} onClick={() => dialog.open('date', h)}>
                    Change the date
                  </Button>
                  <Button size="sm" variant="outline" icon={IconLockOpen} onClick={() => setRelease({ holdId: h.id, name: h.variant })}>
                    Take off hold
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {released.length > 0 ? (
        <Card aria-labelledby="holds-released">
          <CardHeader band level="h2" titleId="holds-released" title="Taken off hold lately" subtitle="The last ten, newest first." />
          <LedgerList label="Lifted holds">
            {released.map((h) => (
              <LedgerItem key={h.id} tone="poured">
                <span className="grid grid-cols-1 items-baseline gap-4 desktop:grid-cols-[minmax(160px,1fr)_2fr_minmax(180px,1fr)] desktop:gap-16">
                  <span className="text-ui text-ink">{h.variant}</span>
                  <span className="text-body-sm text-ink-muted">
                    {h.reason}
                    {h.releaseNote ? <span className="block text-ink-subtle">Taken off: {h.releaseNote}</span> : null}
                  </span>
                  <span className="text-body-sm text-ink-subtle desktop:text-right">
                    {h.releasedBy}, <span className="font-mono tabular">{formatDateTime(h.releasedAt, timezone)}</span>
                  </span>
                </span>
              </LedgerItem>
            ))}
          </LedgerList>
        </Card>
      ) : null}

      <HoldDialog
        target={hold}
        onClose={() => {
          setHold(null);
          setPick('');
        }}
      />
      <ReleaseHoldDialog target={release} onClose={() => setRelease(null)} />
      <HoldDateDialog open={dialog.is('date')} onClose={dialog.close} hold={dialog.target} />
    </div>
  );
}

function HoldDateDialog({ open, onClose, hold }: { open: boolean; onClose: () => void; hold: ActiveHold | null }) {
  const [date, setDate] = useState('');
  useEffect(() => {
    if (open) setDate(hold?.expectedBack ?? '');
  }, [open, hold]);
  return (
    <FormDialog open={open && Boolean(hold)} onClose={onClose} width="md" title={`When is ${hold?.variant ?? ''} back?`} description="The floor still cannot sell it until the hold is taken off." submitLabel="Save the date" onSubmit={() => updateHold({ holdId: hold!.id, expectedBack: date || null })}>
      <TextField type="date" label="Expected back" value={date} onChange={(e) => setDate(e.target.value)} helper="Leave empty if nobody knows yet." />
      {hold?.productId ? (
        <p className="text-body-sm text-ink-muted">
          See <EntityLink kind="product" id={hold.productId}>{hold.product}</EntityLink> for its stock and open orders.
        </p>
      ) : null}
    </FormDialog>
  );
}
