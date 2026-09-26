'use client';

import { RouteError } from '../_components/route-states';

export default function PurchasingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="Purchasing" error={error} reset={reset} />;
}
