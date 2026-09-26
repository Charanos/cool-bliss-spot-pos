'use client';

import { RouteError } from './_components/route-states';

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="This page" error={error} reset={reset} />;
}
