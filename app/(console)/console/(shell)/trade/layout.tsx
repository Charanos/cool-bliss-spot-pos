import type { ReactNode } from 'react';
import * as trade from '@/modules/trade/service';
import { Workspace } from '../_components/workspace';

export default function TradeLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace workspace="trade" counts={{ '/console/trade/open': trade.openTabs().length }}>
      {children}
    </Workspace>
  );
}
