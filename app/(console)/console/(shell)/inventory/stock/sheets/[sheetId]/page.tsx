import { formatDateTime, formatIsoDate, formatQty, formatWeekday, plural } from '@bliss/shared/format';
import { formatKes } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, MetaRow, Totals } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { StatusChip } from '@bliss/ui/components/status';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertTriangle, IconCalendar, IconCheck, IconClipboardList, IconClock, IconPackage, IconReceipt2 } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as identity from '@/modules/identity/service';
import * as stockSheet from '@/modules/inventory/stock-sheet';
import { RecordCrumb } from '../../../../_components/shell/crumbs';
import { BookSheet } from './book-sheet';

export async function generateMetadata({ params }: { params: Promise<{ sheetId: string }> }): Promise<Metadata> {
  const { sheetId } = await params;
  return { title: stockSheet.sheetById(sheetId)?.title ?? 'Stock sheet' };
}

const TENDER: Record<string, string> = { mpesa: 'M-Pesa', card: 'Card', account: 'Unpaid, on account', comp: 'On the house' };

const signed = (n: number, unit: string) => `${n > 0 ? '+' : ''}${formatQty(n, 2)} ${unit}`;

/**
 * A paper stock sheet, reviewed before it is booked: every line against the item it counts, what the
 * night sold, what the shelf holds after, any variance, and what the menu gains. Nothing changes until
 * Book the sheet; after, the page is the record of what was booked.
 */
export default async function StockSheetPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const sheet = stockSheet.sheetById(sheetId);
  if (!sheet) notFound();
  const plan = stockSheet.planSheet(sheet);
  const actor = await identity.currentConsoleActor();
  const tz = identity.outlet().timezone;
  const canBook = identity.can(actor.staffId, 'stock.count.commit') && identity.can(actor.staffId, 'price.write');

  const sections = [...new Set(plan.rows.map((r) => r.section))];
  const variances = plan.rows.filter((r) => r.variance !== 0);
  const doubled = plan.rows.filter((r) => r.soldInBliss > 0);
  const inStock = plan.rows.filter((r) => r.closing > 0);
  const unitsAfter = plan.rows.filter((r) => r.unit === 'unit').reduce((n, r) => n + r.closing, 0);
  const sticksAfter = plan.rows.filter((r) => r.unit === 'stick').reduce((n, r) => n + r.closing, 0);
  const menuToDo = plan.menu.filter((m) => !m.done);
  const head = 'px-12 py-12 text-label text-ink-subtle';

  return (
    <div className="flex flex-col gap-24">
      <RecordCrumb label={plan.title} />
      <DetailHeader
        back={{ href: '/console/inventory/stock', label: 'Stock' }}
        title={plan.title}
        status={plan.applied ? <StatusChip status="committed" label="Booked" /> : <StatusChip status="open" label="Ready to book" />}
        actions={!plan.applied && canBook && plan.missing.length === 0 ? <BookSheet sheetId={plan.id} title={plan.title} items={plan.rows.length} sales={formatKes(plan.salesTotal, { decimals: 'whole' })} /> : null}
        meta={
          <MetaRow
            items={[
              { icon: IconCalendar, value: `${formatWeekday(plan.businessDate)} ${formatIsoDate(plan.businessDate)}` },
              { icon: IconClock, value: `Counts at ${formatDateTime(plan.openAt, tz)} and ${formatDateTime(plan.closeAt, tz)}` },
              { icon: IconClipboardList, value: plural(plan.rows.length, 'line') },
            ]}
          />
        }
      />

      {plan.applied ? (
        <Callout tone="poured" title={`Booked by ${plan.applied.by}, ${formatDateTime(plan.applied.at, tz)}`}>
          The counts are in the stock ledger on {formatIsoDate(plan.businessDate)}, and the night&apos;s sales are bill {plan.applied.billNumber}. The figures below are the record.
        </Callout>
      ) : null}
      {plan.missing.length > 0 ? (
        <Callout tone="stop" title={`${plural(plan.missing.length, 'line')} not on the menu`}>
          {plan.missing.join(', ')}. Add them to the menu, or take them off the sheet, before booking it.
        </Callout>
      ) : null}
      {!plan.applied && doubled.length > 0 ? (
        <Callout tone="low" title="Bliss already holds sales for that night">
          {doubled.map((r) => `${r.item} (${formatQty(r.soldInBliss, 2)})`).join(', ')} were sold on a station that day. The sheet&apos;s sales would count them a second time; its closing count still sets the shelf right.
        </Callout>
      ) : null}

      <MetricGrid columns={4}>
        <Metric label="Counted" icon={IconClipboardList} value={plan.rows.length} detail={`${inStock.length} with stock on the shelf`} />
        <Metric label="On the shelf after" icon={IconPackage} value={formatQty(unitsAfter, 0)} detail={`bottles and cans${sticksAfter > 0 ? `, and ${formatQty(sticksAfter, 0)} cigarettes` : ''}`} />
        <Metric label="Sold that night" icon={IconReceipt2} value={<Money value={plan.salesTotal} size="num-kpi" decimals="whole" />} detail={plural(plan.sales.length, 'line')} />
        <Metric
          label="Variances"
          icon={IconAlertTriangle}
          tone={variances.length > 0 ? 'attention' : 'default'}
          value={variances.length}
          detail={variances.length > 0 ? variances.map((r) => `${r.item} ${signed(r.variance, r.unit === 'stick' ? 'sticks' : '')}`.trim()).join(', ') : 'The shelf held what the sales left'}
        />
      </MetricGrid>

      {plan.menu.length > 0 ? (
        <Card aria-labelledby="sheet-menu">
          <CardHeader band level="h2" titleId="sheet-menu" title="What the menu gains" subtitle={menuToDo.length > 0 ? `${plural(menuToDo.length, 'change')} to make, on booking. A tot is ${plan.totMl}ml.` : 'Every change is in place'} />
          <ul className="flex flex-col">
            {plan.menu.map((m, i) => (
              <li key={`${m.kind}-${m.label}-${i}`} className="flex items-center gap-12 border-b border-rule px-20 py-12 last:border-b-0">
                <span aria-hidden="true" className={cx('flex size-24 shrink-0 items-center justify-center rounded-dot', m.done ? 'bg-poured-wash text-poured' : 'bg-control text-ink-subtle')}>
                  {m.done ? <IconCheck size={14} stroke={2} /> : <span className="size-dot rounded-dot bg-ink-subtle" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui text-ink">{m.label}</span>
                  <span className="block text-body-sm text-ink-muted">{m.detail}</span>
                </span>
                <span className="shrink-0 text-body-sm text-ink-subtle">{m.done ? 'In place' : 'On booking'}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card aria-labelledby="sheet-counts">
        <CardHeader band level="h2" titleId="sheet-counts" title="Counts" subtitle="Opening and closing as written, what the night sold, and what each item holds once the sheet is booked. Cigarettes are in sticks." />
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <caption className="sr-only">Counts on the stock sheet</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className={`${head} pl-20 text-left`}>
                  Item
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Opening
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Sold
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Closing
                </th>
                <th scope="col" className={`${head} text-right`}>
                  Variance
                </th>
                <th scope="col" className={`${head} text-right`}>
                  In Bliss now
                </th>
                <th scope="col" className={`${head} pr-20 text-right`}>
                  {plan.applied ? 'Booked' : 'After booking'}
                </th>
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section}>
                <tr className="border-b border-rule bg-band">
                  <th scope="rowgroup" colSpan={7} className="px-20 py-8 text-left label-caps text-ink-subtle">
                    {section}
                  </th>
                </tr>
                {plan.rows
                  .filter((r) => r.section === section)
                  .map((r) => (
                    <tr key={r.item} className={cx('border-b border-rule align-top last:border-b-0', r.closing === 0 && r.opening === 0 && 'text-ink-subtle')}>
                      <th scope="row" className="py-12 pl-20 pr-12 text-left font-regular">
                        <span className={cx('block truncate text-ui', r.closing === 0 && r.opening === 0 ? 'text-ink-muted' : 'text-ink')}>
                          {r.item}
                          {r.isNew ? <span className="ml-8 text-body-sm text-accent-text">New</span> : null}
                        </span>
                        {r.note ? <span className="block text-body-sm text-ink-subtle">{r.note}</span> : null}
                      </th>
                      <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(r.opening, 2)}</td>
                      <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{r.sold ? formatQty(r.sold, 2) : ''}</td>
                      <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{formatQty(r.closing, 2)}</td>
                      <td className={cx('px-12 py-12 text-right font-mono tabular text-num-md', r.variance < 0 ? 'text-stop' : r.variance > 0 ? 'text-low' : 'text-ink-subtle')}>{r.variance ? signed(r.variance, '').trim() : ''}</td>
                      <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(r.onHandNow, 2)}</td>
                      <td className="py-12 pl-12 pr-20 text-right font-mono tabular text-num-md text-ink">{formatQty(r.onHandAfter, 2)}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </Card>

      <Card aria-labelledby="sheet-sales">
        <CardHeader band level="h2" titleId="sheet-sales" title={`Sold on ${formatWeekday(plan.businessDate)}`} subtitle="One settled bill on that day, each line at the price on the sheet." />
        <ul className="flex flex-col">
          {plan.sales.map((s, i) => (
            <li key={`${s.label}-${i}`} className="flex items-baseline gap-12 border-b border-rule px-20 py-12">
              <span className="w-40 shrink-0 font-mono tabular text-num-md text-ink-muted">{s.qty}×</span>
              <span className="min-w-0 flex-1 truncate text-ui text-ink">{s.label}</span>
              <span className="shrink-0 font-mono tabular text-num-sm text-ink-subtle">{formatKes(s.price, { decimals: 'whole' })}</span>
              <span className="w-96 shrink-0 text-right">
                <Money value={s.total} size="num-md" decimals="whole" />
              </span>
            </li>
          ))}
        </ul>
        <div className="px-20 py-16">
          <Totals
            items={plan.tenders.map((t) => ({ label: `${TENDER[t.kind] ?? t.kind}. ${t.reference}`, value: <Money value={t.amount} size="num-md" decimals="whole" /> }))}
            total={{ label: 'Sales that night', value: <Money value={plan.salesTotal} size="num-lg" decimals="whole" /> }}
          />
        </div>
      </Card>
    </div>
  );
}
