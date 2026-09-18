import type { ReactNode } from 'react';
import * as identity from '@/modules/identity/service';
import * as sync from '@/modules/sync/service';
import { Workspace } from '../_components/workspace';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const devices = identity.devices().filter((d) => d.status === 'active');
  return (
    <Workspace
      title="Settings"
      description="The outlet, the devices allowed to trade, what could not be sent, and the record of every change."
      tabs={[
        { href: '/console/settings/outlet', label: 'Outlet' },
        { href: '/console/settings/devices', label: 'Devices', count: devices.length },
        { href: '/console/settings/sync', label: 'Sync', count: sync.unresolvedCount() || undefined },
        { href: '/console/settings/audit', label: 'Audit trail' },
      ]}
    >
      {children}
    </Workspace>
  );
}
