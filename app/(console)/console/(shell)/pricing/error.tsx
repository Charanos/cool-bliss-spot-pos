'use client';

import { RouteError } from '../_components/route-states';

export default function PricingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="Pricing" error={error} reset={reset} />;
}
