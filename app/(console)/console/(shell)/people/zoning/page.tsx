import type { Metadata } from 'next';
import * as identity from '@/modules/identity/service';
import * as trade from '@/modules/trade/service';
import { ZoningManager } from './zoning-manager';

export const metadata: Metadata = { title: 'Zoning & Tables' };

export default async function ZoningPage() {
  const actor = await identity.currentConsoleActor();
  const zones = trade.zones();
  const tables = trade.tables();
  
  return (
    <div className="flex flex-col gap-24">
      <ZoningManager 
        zones={zones} 
        tables={tables} 
        canManage={identity.can(actor.staffId, 'staff.manage')} 
      />
    </div>
  );
}
