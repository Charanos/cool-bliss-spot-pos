'use client';

import type { DeviceStatus } from '@bliss/shared/domain';
import { Button } from '@bliss/ui/components/button';
import { OverflowMenu } from '@bliss/ui/components/menu';
import { IconArrowBackUp, IconPencil } from '@tabler/icons-react';
import { useDeviceManager } from '../device-manager';

/** The device's own actions, beside its name: the same as the list's menu. */
export function DeviceActions({ device, canManage }: { device: { id: string; label: string; status: DeviceStatus }; canManage: boolean }) {
  const manager = useDeviceManager({ canManage });
  if (!canManage) return null;
  const items = manager.actions(device);
  const primary = items[0];
  return (
    <>
      {device.status === 'active' ? (
        <Button variant="outline" icon={IconPencil} onClick={() => manager.rename(device)}>
          Rename
        </Button>
      ) : primary ? (
        <Button variant="primary" icon={IconArrowBackUp} onClick={() => primary.onSelect()}>
          {primary.label}
        </Button>
      ) : null}
      {device.status === 'active' ? <OverflowMenu label={`More for ${device.label}`} items={items.filter((i) => i.key !== 'rename')} /> : null}
      {manager.dialogs}
    </>
  );
}
