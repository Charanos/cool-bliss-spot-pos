'use client';

import { RouteError } from '../_components/route-states';

export default function PeopleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="People" error={error} reset={reset} />;
}
