'use client';

import { RouteError } from '../_components/route-states';

export default function TradeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="Trade" error={error} reset={reset} />;
}
