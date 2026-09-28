import { formatBps, formatTime, plural } from '@bliss/shared/format';
import { abs, shareBps } from '@bliss/shared/money';
import { SegmentBar } from '@bliss/ui/components/console/gauges';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import type { Tone } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconCash, IconChevronRight, IconLock, IconLockOpen, IconWallet } from '@tabler/icons-react';
import Link from 'next/link';
import { TENDER_LABEL } from '../../_lib/labels';
import type { OverviewData } from '../_data';
import { Panel, PanelEmpty } from './panel';

const TENDER_TONE: Record<string, Tone> = { cash: 'poured', mpesa: 'accent', card: 'info', account: 'low', comp: 'neutral' };

/**
 * Where the money is: how the night was paid (cash, M-Pesa, card) as one bar with each share, and
 * every drawer of the night, open or counted, with its cash in and out and how the count came out.
 */
export function MoneyPanel({ d }: { d: OverviewData }) {
  const closedShort = d.drawers.filter((x) => x.status === 'closed' && x.variance !== null && x.variance !== 0n);
  return (
    <Panel
      id="overview-money"
      icon={IconWallet}
      title="How it was paid"
      subtitle={d.tenders.length > 0 ? `${d.live ? 'Tonight' : 'Last night'}, by tender` : 'Nothing settled yet'}
      cardTone={closedShort.some((x) => abs(x.variance!) > 50_000n) ? 'low' : undefined}
      href="/console/trade/drawers"
      hrefLabel="Drawers and cash"
    >
      {d.tenders.length > 0 ? (
        <div className="flex flex-col gap-16 px-20 py-16">
          <SegmentBar legend={false} label="Takings by tender" segments={d.tenders.map((t) => ({ key: t.kind, label: TENDER_LABEL[t.kind], value: Number(t.amount), tone: TENDER_TONE[t.kind] ?? 'neutral' }))} />
          <ul className="grid grid-cols-1 gap-x-20 gap-y-12 compact:grid-cols-2">
            {d.tenders.map((t) => (
              <li key={t.kind} className="flex items-center gap-12">
                <span aria-hidden="true" className={cx('h-24 w-4 shrink-0 rounded-pill', TENDER_TONE[t.kind] === 'poured' ? 'bg-poured' : TENDER_TONE[t.kind] === 'accent' ? 'bg-accent' : TENDER_TONE[t.kind] === 'info' ? 'bg-info' : TENDER_TONE[t.kind] === 'low' ? 'bg-low' : 'bg-ink-subtle')} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-ui text-ink">{TENDER_LABEL[t.kind]}</span>
                  <span className="text-micro text-ink-subtle">
                    {plural(t.count, 'payment')} · {formatBps(shareBps(t.amount, d.tendersTotal))}
                  </span>
                </span>
                <Money value={t.amount} size="num-md" decimals="whole" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <PanelEmpty icon={IconWallet} title="Nothing paid yet" body="Cash, M-Pesa and card split out here as bills are settled." />
      )}

      <div className="flex flex-col border-t border-edge">
        <p className="px-20 pb-4 pt-12 label-caps text-ink-subtle">Drawers</p>
        {d.drawers.length === 0 ? (
          <p className="px-20 pb-16 text-body-sm text-ink-muted">No drawer opened {d.live ? 'tonight' : 'that night'}.</p>
        ) : (
          <ul className="flex flex-col">
            {d.drawers.map((x) => {
              const open = x.status !== 'closed';
              const off = x.variance !== null && x.variance !== 0n;
              return (
                <li key={x.id}>
                  <Link href={`/console/trade/drawers/${x.id}`} className="group flex items-center gap-12 px-20 py-8 transition-hover hover:bg-band">
                    <span className={cx('flex size-control-sm shrink-0 items-center justify-center rounded-md', open ? 'bg-poured-wash text-poured' : 'bg-band text-ink-subtle')}>
                      {open ? <IconLockOpen size={16} stroke={ICON_STROKE} aria-hidden="true" /> : <IconLock size={16} stroke={ICON_STROKE} aria-hidden="true" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-ui text-ink">
                        {x.device} <span className="text-body-sm text-ink-subtle">· {x.openedBy}</span>
                      </span>
                      <span className="text-micro text-ink-subtle">
                        {open ? `Open since ${formatTime(x.openedAt, d.tz)}` : `Counted ${x.closedAt ? formatTime(x.closedAt, d.tz) : ''}`} · {plural(x.cashBills, 'cash bill')}
                        {x.movements > 0 ? ` · ${plural(x.movements, 'movement')}` : ''}
                      </span>
                    </span>
                    {open ? (
                      <span className="flex flex-col items-end">
                        <span className="label-caps text-ink-subtle">Float</span>
                        <Money value={x.float} size="num-sm" decimals="whole" />
                      </span>
                    ) : (
                      <span className="flex flex-col items-end">
                        <span className="label-caps text-ink-subtle">{off ? (x.variance! < 0n ? 'Short' : 'Over') : 'Exact'}</span>
                        {off ? <Money value={abs(x.variance!)} size="num-sm" decimals="whole" tone="attention" /> : <IconCash size={16} stroke={ICON_STROKE} aria-hidden="true" className="text-poured" />}
                      </span>
                    )}
                    <IconChevronRight size={16} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-2" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
