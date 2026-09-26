'use client';

import { RouteError } from '../_components/route-states';

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError what="Settings" error={error} reset={reset} />;
}
