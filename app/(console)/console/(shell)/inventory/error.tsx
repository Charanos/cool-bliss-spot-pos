'use client';

import { RouteError } from '../_components/route-states';

export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="Inventory" error={error} reset={reset} />;
}
