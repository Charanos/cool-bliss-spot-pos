import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="pricing">{children}</Workspace>;
}
