import { cents } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardBody, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { Callout, DetailHeader, KeyValueList, LedgerItem, LedgerList, MetaRow, Section, Separator, SummaryStrip, Totals } from '@bliss/ui/components/console/section';
import { PageHeader } from '@bliss/ui/components/console/shell';
import { Badge } from '@bliss/ui/components/badge';
import { EmptyState, InlineNotice } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { STATUS, type StatusKey, StatusChip, ToneChip } from '@bliss/ui/components/status';
import { IconCash, IconClock, IconReceipt, IconScale } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { devDataEnabled } from '@/lib/dev';
import { KitInteractive } from './kit-interactive';

export const metadata: Metadata = { title: 'Primitives' };

/**
 * Every Console primitive on one page, for visual review in both themes. docs/19 section 3. Off in a
 * production build unless development data is switched on for a review environment.
 */
export default function KitPage() {
  if (!devDataEnabled()) notFound();
  return (
    <div className="flex flex-col gap-40">
      <PageHeader title="Primitives" description="Every Console primitive in one place, to review in light and dark before a page uses it." />

      <Section id="kit-type" title="Type" description="Three heading levels, body, small, label, capitals and figures.">
        <Card>
          <CardBody className="flex flex-col gap-12 pt-20">
            <p className="text-title-page text-ink">Page title, 26</p>
            <p className="text-title-section text-ink">Section title, 17</p>
            <p className="text-title-card text-ink">Card title, 15</p>
            <p className="text-ui text-ink">Body, 14. The default Console text, for anything a person reads in a row.</p>
            <p className="text-body-sm text-ink-muted">Small, 13. Secondary lines, meta and help.</p>
            <p className="text-label text-ink-subtle">Label, 12</p>
            <p className="label-caps text-ink-subtle">Capitals over a value</p>
            <p className="flex items-baseline gap-24">
              <Money value={cents(128_450_00)} size="num-kpi" decimals="whole" />
              <Money value={cents(-3_500_00)} size="num-md" />
              <span className="font-mono tabular text-num-sm text-ink-subtle">12.5%</span>
            </p>
          </CardBody>
        </Card>
      </Section>

      <Section id="kit-status" title="States and tones" description="A dot and a word on a wash of their tone, so a state survives greyscale.">
        <div className="flex flex-wrap gap-8">
          {(Object.keys(STATUS) as StatusKey[]).map((k) => (
            <StatusChip key={k} status={k} />
          ))}
        </div>
        <div className="flex flex-wrap gap-8">
          {(['poured', 'served', 'low', 'stop', 'info', 'neutral', 'accent'] as const).map((t) => (
            <ToneChip key={t} tone={t}>
              {t}
            </ToneChip>
          ))}
          <Badge tone="accent">Badge</Badge>
        </div>
      </Section>

      <Section id="kit-metrics" title="Metrics">
        <MetricGrid>
          <Metric label="Settled" icon={IconReceipt} value={<Money value={cents(84_320_00)} size="num-kpi" decimals="whole" />} delta={{ bps: 740, against: 'last Friday' }} />
          <Metric label="Gross margin" icon={IconScale} tone="poured" value="48.6%" detail="After VAT" />
          <Metric label="Open over 4 hours" icon={IconClock} tone="attention" value="3" detail="Worth a word with the waiter" href="/console/trade/open" />
          <Metric label="Voided" icon={IconCash} tone="stop" value={<Money value={cents(4_200_00)} size="num-kpi" decimals="whole" />} delta={{ bps: 1200, against: 'last week', invert: true }} />
        </MetricGrid>
      </Section>

      <Section id="kit-cards" title="Cards" description="One surface; its header and footer are bands, never a card inside a card.">
        <div className="grid grid-cols-1 gap-16 desktop:grid-cols-3">
          <Card as="article" interactive>
            <CardHeader band href="/console/trade/bills" title="Bill 21808" subtitle="T2, by seat" meta={<StatusChip status="settled" />} />
            <CardStats>
              <Stat label="Paid by">M-Pesa</Stat>
              <Stat label="Cashier">Kevin</Stat>
            </CardStats>
            <CardFooter>
              <span className="text-body-sm text-ink-muted">Total</span>
              <Money value={cents(1_270_00)} size="num-md" />
            </CardFooter>
          </Card>
          <Card tone="low">
            <CardHeader band icon={IconClock} tone="low" title="With a tone edge" subtitle="For a record that needs a second look" />
            <CardBody className="pt-12">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Delivery note', value: 'DN-1042', mono: true },
                  { label: 'Received by', value: 'Grace' },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader band title="Totals" />
            <CardBody className="pt-12">
              <Totals
                items={[
                  { label: 'Subtotal', value: <Money value={cents(1_270_00)} size="num-md" /> },
                  { label: 'VAT included', value: <Money value={cents(175_17)} size="num-md" tone="muted" /> },
                ]}
                total={{ label: 'Total', value: <Money value={cents(1_270_00)} size="num-lg" /> }}
              />
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section id="kit-composition" title="Page parts">
        <DetailHeader back={{ href: '/console/kit', label: 'Primitives' }} title="Detail header" status={<StatusChip status="open" />} meta={<MetaRow items={[{ value: 'Main bar' }, { value: 'Opened 17:35' }, { value: 'Amina' }]} />} actions={<ButtonLink href="/console/kit">An action</ButtonLink>} />
        <Callout tone="stop" title="A callout, stop" aside={<Money value={cents(9_110_00)} size="num-lg" decimals="whole" />}>
          Something that needs a person, said once, with what to do.
        </Callout>
        <Callout tone="info" title="A callout, info">
          Context the page wants read before the figures.
        </Callout>
        <InlineNotice tone="stop">An inline notice, for a refusal inside a form.</InlineNotice>
        <SummaryStrip items={[{ label: 'Accepted', value: '24' }, { label: 'Sent back', value: '2' }, { label: 'Value', value: <Money value={cents(6_960_00)} size="num-md" /> }]} />
        <Separator label="A named rule" />
        <LedgerList label="Example history">
          <LedgerItem>
            <span className="block text-body-sm text-ink">Opened by Amina for 6 guests</span>
          </LedgerItem>
          <LedgerItem tone="stop">
            <span className="block text-body-sm text-ink">Line voided by Amina</span>
          </LedgerItem>
          <LedgerItem tone="poured">
            <span className="block text-body-sm text-ink">Bill settled</span>
          </LedgerItem>
        </LedgerList>
        <EmptyState title="An empty state" body="Says what will appear here, and how it gets there." />
      </Section>

      <KitInteractive />
    </div>
  );
}
