'use client';

import { Button } from '@bliss/ui/components/button';
import { IconDownload, IconRefresh, IconTool } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { applyUpdate, buildStanding, checkForUpdate, repairAppCopy, useAppUpdate } from '@/lib/pos/updates';
import { Panel } from './station-settings';

/** Whether this device can open the app with no network: a worker in charge and pages kept. */
function useOfflineReady(): 'yes' | 'no' | 'checking' {
  const [ready, setReady] = useState<'yes' | 'no' | 'checking'>('checking');
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const controlled = Boolean(navigator.serviceWorker?.controller);
        const keys = 'caches' in window ? await caches.keys() : [];
        const kept = keys.some((k) => k.startsWith('bliss-pages-')) && keys.some((k) => k.includes('precache'));
        if (live) setReady(controlled && kept ? 'yes' : 'no');
      } catch {
        if (live) setReady('no');
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

/**
 * The app on this device: which build it runs, whether that is the server's, whether it opens with no
 * network, and the two things to do about it. Check looks for a newer build now; Repair drops this
 * device's copy of the app and loads it fresh, leaving its orders and sign-in where they are.
 * docs/16-responsive-and-offline.md section 5.
 */
export function AppCopyPanel() {
  const { ready, applying } = useAppUpdate();
  const offline = useOfflineReady();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'repair' | null>(null);
  const [standing, setStanding] = useState(() => buildStanding());
  useEffect(() => {
    const timer = window.setInterval(() => setStanding(buildStanding()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const own = standing.own || 'Development';
  const server = !standing.server ? 'Not heard yet' : standing.server === standing.own ? 'The same' : `Newer, ${standing.server}`;

  return (
    <Panel title="The app on this device" id="settings-app" icon={IconDownload} lede="Newer versions arrive by themselves and go in when nobody is using the tablet.">
      <dl className="grid grid-cols-1 gap-8 pad:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-card bg-sunken/80 px-16 py-12">
          <dt className="text-label text-ink-subtle">This build</dt>
          <dd className="font-mono text-body font-medium text-ink">{own}</dd>
        </div>
        <div className="flex flex-col gap-4 rounded-card bg-sunken/80 px-16 py-12">
          <dt className="text-label text-ink-subtle">The server&apos;s</dt>
          <dd className={ready ? 'text-body font-medium text-low' : 'text-body font-medium text-ink'}>{server}</dd>
        </div>
        <div className="flex flex-col gap-4 rounded-card bg-sunken/80 px-16 py-12">
          <dt className="text-label text-ink-subtle">Opens with no network</dt>
          <dd className={offline === 'no' ? 'text-body font-medium text-low' : 'text-body font-medium text-ink'}>{offline === 'yes' ? 'Yes' : offline === 'no' ? 'Not yet, reload once online' : 'Checking'}</dd>
        </div>
      </dl>
      {message ? (
        <p role="status" className="text-body-sm text-ink-muted">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-8">
        {ready ? (
          <Button
            variant="primary"
            shape="pill"
            icon={IconRefresh}
            loading={applying}
            onClick={() =>
              void applyUpdate().then((r) => {
                if (!r.ok) setMessage(r.message);
              })
            }
          >
            Restart into the newer version
          </Button>
        ) : (
          <Button
            variant="secondary"
            shape="pill"
            icon={IconRefresh}
            loading={busy === 'check'}
            onClick={async () => {
              setBusy('check');
              const result = await checkForUpdate();
              setBusy(null);
              setStanding(buildStanding());
              setMessage(result === 'offline' ? 'This tablet is offline. It looks again when the network is back.' : result === 'ready' ? 'A newer version is out. Restart into it now, or leave it to go in by itself.' : 'This is the newest version.');
            }}
          >
            Check for a newer version
          </Button>
        )}
        <Button
          variant="ghost"
          shape="pill"
          icon={IconTool}
          loading={busy === 'repair'}
          onClick={async () => {
            setBusy('repair');
            const result = await repairAppCopy();
            setBusy(null);
            if (!result.ok) setMessage(result.message);
          }}
        >
          Repair the app
        </Button>
      </div>
    </Panel>
  );
}
