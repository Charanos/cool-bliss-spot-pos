import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import * as trade from '@/modules/trade/service';
import { ZoningManager } from './zoning-manager';
import { ViewHeader } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Zones and tables' };

/** The floor as the tablets draw it: zones, the tables in each, and how many seats a table has. */
export default async function ZoningPage() {
  const actor = await identity.currentConsoleActor();
  return (
    <>
      <ViewHeader page="/console/people/zoning" />

    <ZoningManager
      zones={trade.zones()}
      tables={trade.tables()}
      priceLists={pricing.priceLists().map((l) => ({ value: l.id, label: l.name }))}
      canManage={identity.can(actor.staffId, 'staff.manage')}
    />
    </>
  );
}
