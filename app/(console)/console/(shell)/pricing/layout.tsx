import type { ReactNode } from 'react';
import * as pricing from '@/modules/pricing/service';
import { Workspace } from '../_components/workspace';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      workspace="pricing"
      counts={{ '/console/pricing/lists': pricing.priceLists().filter((l) => l.status === 'active').length, '/console/pricing/rules': pricing.rules().filter((r) => r.status === 'active').length }}
    >
      {children}
    </Workspace>
  );
}
