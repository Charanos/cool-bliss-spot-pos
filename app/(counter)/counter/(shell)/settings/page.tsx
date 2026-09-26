'use client';

import { DeviceCard } from '@/app/_pos/device-card';

/**
 * The counter's own settings: what this device is and how Bliss draws on it. Everything about the
 * venue itself is set in the Console.
 */
export default function CounterSettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-form flex-col gap-24 px-24 py-24">
        <header className="flex flex-col gap-4">
          <h1 className="text-title-page text-ink">Settings</h1>
          <p className="text-body text-ink-muted">This counter, and how Bliss looks on its screen. The venue itself is set in the Console.</p>
        </header>
        <DeviceCard />
      </div>
    </div>
  );
}
