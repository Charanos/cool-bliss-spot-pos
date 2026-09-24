import type { ReactNode } from 'react';
import { Workspace } from '../_components/workspace';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <Workspace
      eyebrow="INTELLIGENCE · BUSINESS AUDIT"
      title="Reports"
      description="Every figure is keyed on the business day, cutover to cutover, never the calendar date."
      tabs={[
        { href: '/console/reports/sales', label: 'Sales' },
        { href: '/console/reports/pour-variance', label: 'Pour variance' },
        { href: '/console/reports/voids', label: 'Voids and discounts' },
        { href: '/console/reports/seats', label: 'Seats' },
        { href: '/console/reports/dead-stock', label: 'Dead stock' },
      ]}
    >
      {children}
    </Workspace>
  );
}
