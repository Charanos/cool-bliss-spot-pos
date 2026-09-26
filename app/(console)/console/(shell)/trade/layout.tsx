import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function TradeLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="trade">{children}</Workspace>;
}
