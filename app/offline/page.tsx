export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-20 px-24 text-center">
      {/* Animated status dot */}
      <span
        className="h-10 w-10 rounded-full bg-amber-400/80 shadow-[0_0_16px_4px_theme(colors.amber.400/0.3)]"
        style={{ animation: 'bliss-breathe 2.4s ease-in-out infinite' }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-8">
        <h1 className="text-title font-medium text-ink" style={{ letterSpacing: '-0.015em' }}>
          Tablet is offline
        </h1>
        <p className="max-w-[34ch] text-body text-ink-muted">
          No network connection. Your orders and tabs are safely stored on this device and will
          sync automatically when the connection is restored.
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <span className="text-body-sm text-ink-subtle">
          All data is available. Continue taking orders as normal.
        </span>
      </div>
    </main>
  );
}
