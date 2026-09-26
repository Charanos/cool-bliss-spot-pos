import type { Metadata } from 'next';
import { dynamicsPnl } from '@/modules/reporting/dynamics';
import { DynamicsDashboard } from './dynamics-dashboard';

export const metadata: Metadata = {
  title: 'Dynamics P&L',
  description: 'Live executive P&L statement that updates as tabs close, with real COGS, Nairobi opex, and the Four Owner Questions.',
};

export default async function DynamicsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: 'today' | 'last_night' | 'week' | 'month' | 'event'; date?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? 'last_night';
  const report = dynamicsPnl(filter, params.date);

  return <DynamicsDashboard report={report} />;
}
