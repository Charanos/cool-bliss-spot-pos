import { formatBps } from '@bliss/shared/format';
import { formatKes } from '@bliss/shared/money';
import { ConsoleBentoCard } from '@bliss/ui/components/console/metric';
import {
  IconBuildingStore,
  IconCoins,
  IconLayoutDashboard,
  IconPackage,
} from '@tabler/icons-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as trade from '@/modules/trade/service';

export const metadata: Metadata = { title: 'Outlet' };

const LOCATION_KIND: Record<string, string> = { store: 'Store room', service: 'Behind the bar', retail: 'Bottle counter' };

const icon = (Glyph: typeof IconBuildingStore) => <Glyph size={18} stroke={1.5} />;

/**
 * Outlet profile and operating parameters.
 * Polished with Bento cards, ambient glow rules, and clear typography.
 */
export default function OutletPage() {
  const outlet = identity.outlet();
  const zones = trade.zones();
  const tables = trade.tables();

  return (
    <div className="grid grid-cols-1 gap-20 desktop:grid-cols-2">
      <ConsoleBentoCard
        icon={icon(IconBuildingStore)}
        title="Outlet profile"
        subtitle="Venue legal identity, cutover, and operating parameters"
        tone="default"
      >
        <dl className="flex flex-col">
          <Row label="Name">{outlet.name}</Row>
          <Row label="Registered as">{outlet.legalName}</Row>
          <Row label="Address">{outlet.address}</Row>
          <Row label="Time zone">{outlet.timezone}</Row>
          <Row label="Business day cutover" mono>
            {outlet.businessDayCutover}
          </Row>
          <Row label="">
            <span className="text-body-sm text-ink-subtle">
              A sale at 01:47 belongs to the night before. Every report and day close keys on the business day.
            </span>
          </Row>
        </dl>
      </ConsoleBentoCard>

      <ConsoleBentoCard
        icon={icon(IconCoins)}
        title="Fiscal & currency"
        subtitle="Tax registration, currency base, and cash variance threshold"
        tone="default"
      >
        <dl className="flex flex-col">
          <Row label="Currency">Kenyan shilling (KES), kept in cents</Row>
          <Row label="VAT rate" mono>
            {formatBps(outlet.taxRateBps)}
          </Row>
          <Row label="Prices">{outlet.pricesTaxInclusive ? 'Include VAT' : 'Exclude VAT'}</Row>
          <Row label="Rounding">Once, at tender, half up to the nearest shilling</Row>
          <Row label="Drawer variance allowed" mono>
            {formatKes(outlet.drawerVarianceThresholdCents, { decimals: 'whole' })}
          </Row>
          <Row label="">
            <span className="text-body-sm text-ink-subtle">
              Tenders are recorded as the cashier saw them. Bliss makes no call to external payment providers.
            </span>
          </Row>
        </dl>
      </ConsoleBentoCard>

      <ConsoleBentoCard
        icon={icon(IconPackage)}
        title="Inventory locations"
        subtitle="Stock tracking points, default delivery destination, and service bar"
        tone="default"
      >
        <dl className="flex flex-col">
          <Row label="Low stock default" mono>
            {outlet.lowStockDefault} units
          </Row>
          {inventory.locations().map((l) => (
            <Row key={l.id} label={l.name}>
              {LOCATION_KIND[l.kind] ?? l.kind}
              {l.isDefaultReceipt ? ', deliveries arrive here' : ''}
              {l.isDefaultSale ? ', sales draw from here' : ''}
            </Row>
          ))}
        </dl>
      </ConsoleBentoCard>

      <ConsoleBentoCard
        icon={icon(IconLayoutDashboard)}
        title="Floor zones & capacity"
        subtitle="Configured dining areas, tables, and total seats"
        tone="default"
      >
        <dl className="flex flex-col">
          {zones.map((z) => {
            const own = tables.filter((t) => t.zoneId === z.id);
            return (
              <Row key={z.id} label={z.name}>
                <span className="font-mono tabular text-num">{own.map((t) => t.label).join(' ')}</span>
                <span className="block text-body-sm text-ink-subtle">{own.reduce((a, t) => a + t.seats, 0)} seats</span>
              </Row>
            );
          })}
        </dl>
      </ConsoleBentoCard>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-16 border-b border-rule/60 py-10 last:border-b-0">
      <dt className="text-body-sm font-medium text-ink-subtle">{label}</dt>
      <dd className={mono ? 'font-mono tabular text-num-sm text-ink' : 'text-body-sm text-ink'}>{children}</dd>
    </div>
  );
}
