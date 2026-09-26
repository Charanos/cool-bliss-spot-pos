import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <Workspace workspace="settings">{children}</Workspace>;
}
