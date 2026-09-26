'use client';

import { PageHeader } from '@bliss/ui/components/console/shell';
import { RouteTabs, type TabLink } from '@bliss/ui/components/console/tabs';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isRecordPath } from '../_lib/nav';

/**
 * A workspace's header and views. On a record page (a bill, a delivery, a product) both step aside:
 * the record has its own header with a way back, and tabs above it would light up nothing.
 */
export function WorkspaceChrome({ title, description, actions, tabs }: { title: string; description: string; actions?: ReactNode; tabs: readonly TabLink[] }) {
  const pathname = usePathname();
  if (isRecordPath(pathname)) return null;
  return (
    <div className="flex flex-col">
      <PageHeader title={title} description={description} actions={actions} />
      {tabs.length > 0 ? <RouteTabs label={`${title} views`} tabs={tabs} className="sticky top-bar z-sticky bg-page" /> : null}
    </div>
  );
}
