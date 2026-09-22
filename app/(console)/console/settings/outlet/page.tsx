import { formatBps } from '@bliss/shared/format';
import { formatKes } from '@bliss/shared/money';
import { RevealSection } from '@bliss/ui/components/console/shell';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as trade from '@/modules/trade/service';

export const metadata: Metadata = { title: 'Outlet' };

const LOCATION_KIND: Record<string, string> = { store: 'Store room', service: 'Behind the bar', retail: 'Bottle counter' };

/** The facts every figure in Bliss depends on: the business day, the tax basis, the thresholds. */
export default function OutletPage() {
  const outlet = identity.outlet();
  const zones = trade.zones();
  const tables = trade.tables();
  return (
    <div className="grid grid-cols-1 gap-16 desktop:grid-cols-2">
      <Pane title="Outlet">
        <Row label="Name">{outlet.name}</Row>
        <Row label="Registered as">{outlet.legalName}</Row>
        <Row label="Address">{outlet.address}</Row>
        <Row label="Time zone">{outlet.timezone}</Row>
        <Row label="Business day starts" mono>
          {outlet.businessDayCutover}
        </Row>
        <Row label="">
          <span className="text-body-sm text-ink-subtle">A sale at 01:47 belongs to the night before. Every report and every day close keys on the business day.</span>
        </Row>
      </Pane>

      <Pane title="Money">
        <Row label="Currency">Kenyan shilling, kept in cents</Row>
        <Row label="VAT" mono>
          {formatBps(outlet.taxRateBps)}
        </Row>
        <Row label="Prices">{outlet.pricesTaxInclusive ? 'Include VAT' : 'Exclude VAT'}</Row>
        <Row label="Rounding">Once, at tender, half up to the nearest shilling</Row>
        <Row label="Drawer variance allowed" mono>
          {formatKes(outlet.drawerVarianceThresholdCents, { decimals: 'whole' })}
        </Row>
        <Row label="">
          <span className="text-body-sm text-ink-subtle">Tenders are recorded as the cashier saw them. Bliss makes no call to any payment provider.</span>
        </Row>
      </Pane>

      <Pane title="Stock">
        <Row label="Low stock default" mono>
          {outlet.lowStockDefault}
        </Row>
        {inventory.locations().map((l) => (
          <Row key={l.id} label={l.name}>
            {LOCATION_KIND[l.kind] ?? l.kind}
            {l.isDefaultReceipt ? ', deliveries arrive here' : ''}
            {l.isDefaultSale ? ', sales draw from here' : ''}
          </Row>
        ))}
      </Pane>

      <Pane title="Floor plan">
        {zones.map((z) => {
          const own = tables.filter((t) => t.zoneId === z.id);
          return (
            <Row key={z.id} label={z.name}>
              <span className="font-mono tabular text-num">{own.map((t) => t.label).join(' ')}</span>
              <span className="block text-body-sm text-ink-subtle">{own.reduce((a, t) => a + t.seats, 0)} seats</span>
            </Row>
          );
        })}
      </Pane>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <RevealSection className="rounded-md border border-hairline bg-raised p-20 shadow-raised">
      <h2 className="text-subtitle text-ink">{title}</h2>
      <dl className="mt-12">{children}</dl>
    </RevealSection>
  );
}

function Row({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-16 border-b border-rule-raised py-8 last:border-b-0">
      <dt className="text-body text-ink-subtle">{label}</dt>
      <dd className={mono ? 'font-mono tabular text-num text-ink' : 'text-body text-ink'}>{children}</dd>
    </div>
  );
}
