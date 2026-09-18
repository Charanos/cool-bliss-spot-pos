import type { ReactNode } from 'react';
import * as trade from '@/modules/trade/service';
import { Workspace } from '../_components/workspace';

export default function TradeLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      title="Trade"
      description="Tabs, bills, drawers and shifts. Tenders are what the cashier recorded; Bliss never confirms a payment."
      tabs={[
        { href: '/console/trade/open', label: 'Open tabs', count: trade.openTabs().length || undefined },
        { href: '/console/trade/bills', label: 'Bills' },
        { href: '/console/trade/drawers', label: 'Drawers' },
        { href: '/console/trade/shifts', label: 'Shifts' },
      ]}
    >
      {children}
    </Workspace>
  );
}
