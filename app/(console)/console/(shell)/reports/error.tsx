'use client';

import { RouteError } from '../_components/route-states';

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="This report" error={error} reset={reset} />;
}
