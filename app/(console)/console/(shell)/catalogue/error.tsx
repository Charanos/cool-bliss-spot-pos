'use client';

import { RouteError } from '../_components/route-states';

export default function CatalogueError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="The catalogue" error={error} reset={reset} />;
}
