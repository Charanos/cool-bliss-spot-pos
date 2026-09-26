import { permanentRedirect } from 'next/navigation';

/** The report was called Dynamics; old links and bookmarks land on Performance. */
export default async function DynamicsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { range } = await searchParams;
  permanentRedirect(range ? `/console/reports/performance?range=${encodeURIComponent(range)}` : '/console/reports/performance');
}
