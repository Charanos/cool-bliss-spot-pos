import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
import { Workspace } from '../_components/workspace';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      workspace="settings"
      counts={{ '/console/settings/devices': identity.devices().filter((d) => d.status === 'active').length, '/console/settings/sync': sync.unresolvedCount() }}
      attention={['/console/settings/sync']}
    >
      {children}
    </Workspace>
  );
}
