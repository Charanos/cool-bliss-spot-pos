import type { ReactNode } from 'react';
import * as pricing from '@/modules/pricing/service';
import { Workspace } from '../_components/workspace';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      eyebrow="CATALOGUE & PRICING · TARIFFS & RULES"
      title="Pricing"
      description="Prices include VAT. A change never rewrites a line already fired: each line keeps the derivation it was sold at."
      tabs={[
        { href: '/console/pricing/lists', label: 'Price lists', count: pricing.priceLists().filter((l) => l.status === 'active').length },
        { href: '/console/pricing/rules', label: 'Time rules', count: pricing.rules().filter((r) => r.status === 'active').length },
      ]}
    >
      {children}
    </Workspace>
  );
}
