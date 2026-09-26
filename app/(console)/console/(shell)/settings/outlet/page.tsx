import { formatBps, plural } from '@bliss/shared/format';
import { formatFigure, formatKes } from '@bliss/shared/money';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { ActionPill } from '@bliss/ui/components/console/action-pill';
import { KeyValueList } from '@bliss/ui/components/console/section';
import { IconAlertTriangle, IconBuildingStore, IconCash, IconClockHour4, IconCoins, IconLayoutDashboard, IconPackage, IconReceiptTax } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import * as trade from '@/modules/trade/service';
import { ViewHeader } from '../../_components/workspace';
import { OutletActions } from './outlet-actions';

export const metadata: Metadata = { title: 'Outlet' };

const LOCATION_KIND: Record<string, string> = { store: 'Store room', service: 'Behind the bar', retail: 'Bottle counter' };

/** The outlet as Bliss knows it: who it is, when its day ends, how it charges, where its stock sits. */
export default async function OutletPage() {
  const actor = await identity.currentConsoleActor();
  const outlet = identity.outlet();
  const locations = inventory.locations().filter((l) => l.status === 'active');
  const zones = trade.zones();
  const tables = trade.tables();

  return (
    <>
      <ViewHeader
        page="/console/settings/outlet"
        actions={
          identity.can(actor.staffId, 'staff.manage') ? (
            <OutletActions
              isOwner={actor.role.key === 'owner'}
              outlet={{
                name: outlet.name,
                legalName: outlet.legalName,
                address: outlet.address,
                businessDayCutover: outlet.businessDayCutover,
                taxRatePct: outlet.taxRateBps / 100,
                pricesTaxInclusive: outlet.pricesTaxInclusive,
                lowStockDefault: outlet.lowStockDefault,
                drawerVarianceThreshold: formatFigure(outlet.drawerVarianceThresholdCents, { decimals: 'whole' }).replace(/,/g, ''),
              }}
            />
          ) : null
        }
      />
      <div className="flex flex-col gap-32">
        <MetricGrid>
          <Metric label="VAT" icon={IconReceiptTax} value={formatBps(outlet.taxRateBps)} detail={outlet.pricesTaxInclusive ? 'Included in every price' : 'Added at the bill'} />
          <Metric label="Business day ends" icon={IconClockHour4} value={outlet.businessDayCutover} detail="Sales before this belong to the night before" />
          <Metric label="Drawer allowed out by" icon={IconCash} value={formatKes(outlet.drawerVarianceThresholdCents, { decimals: 'whole' })} detail="Further out is flagged for review" />
          <Metric label="Low stock line" icon={IconAlertTriangle} tone="attention" value={outlet.lowStockDefault} detail="Units, unless an item sets its own" />
        </MetricGrid>
        <div className="grid grid-cols-1 items-start gap-24 desktop:grid-cols-2">
          <Card aria-labelledby="outlet-profile">
            <CardHeader band level="h2" titleId="outlet-profile" icon={IconBuildingStore} title="The outlet" />
            <CardBody className="pt-4">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Name', value: outlet.name },
                  { label: 'Registered as', value: outlet.legalName },
                  { label: 'Address', value: outlet.address },
                  { label: 'Time zone', value: outlet.timezone },
                  {
                    label: 'Business day ends',
                    value: outlet.businessDayCutover,
                    mono: true,
                    hint: 'A sale at 01:47 belongs to the night before. Every report and day close follows the business day.',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card aria-labelledby="outlet-money">
            <CardHeader band level="h2" titleId="outlet-money" icon={IconCoins} title="Tax and money" />
            <CardBody className="pt-4">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Currency', value: 'Kenyan shilling (KES), kept in cents' },
                  { label: 'VAT', value: formatBps(outlet.taxRateBps), mono: true },
                  { label: 'Prices', value: outlet.pricesTaxInclusive ? 'Include VAT' : 'Exclude VAT' },
                  { label: 'Rounding', value: 'Once, when a bill is settled, half up to the nearest shilling' },
                  {
                    label: 'Drawer allowed out by',
                    value: formatKes(outlet.drawerVarianceThresholdCents, { decimals: 'whole' }),
                    mono: true,
                    hint: 'Tenders are recorded as the cashier saw them. Bliss does not contact any payment provider.',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card aria-labelledby="outlet-stock">
            <CardHeader
              band
              level="h2"
              titleId="outlet-stock"
              icon={IconPackage}
              title="Stock locations"
              subtitle={plural(locations.length, 'location')}
              actions={<ActionPill href="/console/settings/locations">Manage</ActionPill>}
            />
            <CardBody className="pt-4">
              <KeyValueList
                layout="inline"
                items={[
                  { label: 'Low stock, unless set', value: plural(outlet.lowStockDefault, 'unit'), mono: true },
                  ...locations.map((l) => ({
                    label: l.name,
                    value: [LOCATION_KIND[l.kind] ?? l.kind, l.isDefaultReceipt ? 'deliveries arrive here' : null, l.isDefaultSale ? 'sales draw from here' : null].filter(Boolean).join(', '),
                  })),
                ]}
              />
            </CardBody>
          </Card>

          <Card aria-labelledby="outlet-floor">
            <CardHeader
              band
              level="h2"
              titleId="outlet-floor"
              icon={IconLayoutDashboard}
              title="The floor"
              subtitle={`${plural(tables.length, 'table')}, ${plural(
                tables.reduce((n, t) => n + t.seats, 0),
                'seat',
              )}`}
              actions={<ActionPill href="/console/people/zoning">Zones and tables</ActionPill>}
            />
            <CardBody className="pt-4">
              <KeyValueList
                layout="inline"
                items={zones.map((z) => {
                  const own = tables.filter((t) => t.zoneId === z.id);
                  return {
                    label: z.name,
                    value: own.map((t) => t.label).join(', ') || 'No tables',
                    hint: plural(
                      own.reduce((n, t) => n + t.seats, 0),
                      'seat',
                    ),
                  };
                })}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
