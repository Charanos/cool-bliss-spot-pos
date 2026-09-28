'use client';

import { Switch } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertTriangle, IconCheck, IconDeviceDesktop, IconDeviceTablet } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { CHECKS, type DeviceCaps, type DisplayProfile, readCaps } from '@/lib/pos/device-caps';
import { setDisplay, useDisplay } from '@/lib/pos/display';

const PROFILE_COPY: Record<Exclude<DisplayProfile, 'standard'>, { label: string; helper: string }> = {
  lite: { label: 'Lite', helper: 'Calmer and quicker on older tablets: less movement, and panels you cannot see through.' },
  clarity: { label: 'Clarity', helper: 'Stronger edges and colours, easier to read in a dim bar. On from the start.' },
};

/**
 * This device: whether it is ready for service, what to do when it is not, and how the screen looks.
 * Written for whoever runs the bar, so it names what to do, never how the browser does it. The full
 * technical reading goes to the Console with the sync, on the device's record. docs/16 section 1.
 */
export function DeviceCard() {
  const [caps, setCaps] = useState<DeviceCaps | null>(null);
  const display = useDisplay();

  useEffect(() => {
    const read = () => setCaps(readCaps());
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  if (!caps) return null;
  const blocking = CHECKS.filter((c) => c.needed && !caps.checks[c.key]);
  // Only what someone can act on: a missing need, or the screen that will not stay on by itself.
  const notes = CHECKS.filter((c) => !caps.checks[c.key] && (c.needed || c.key === 'wakeLock'));
  const Glyph = caps.pointer === 'touch' ? IconDeviceTablet : IconDeviceDesktop;
  const kind = /iPadOS|iOS|Android/.test(caps.system) || caps.pointer === 'touch' ? 'Tablet' : 'Computer';

  const toggle = (profile: Exclude<DisplayProfile, 'standard'>, on: boolean) => {
    const current = new Set(display.active);
    if (on) current.add(profile);
    else current.delete(profile);
    setDisplay([...current]);
  };

  return (
    <section aria-labelledby="device-title" className="flex flex-col gap-20 rounded-sheet border border-rule-raised/40 p-20 surface-card tablet:p-24">
      <header className="flex items-start gap-12">
        <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-accent-wash text-accent-text">
          <Glyph size={20} stroke={ICON_STROKE} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id="device-title" className="text-title font-medium text-ink">
            This device
          </h2>
          <p className="text-body-sm text-ink-muted">{kind}, {caps.pointer === 'touch' ? 'touch screen' : 'mouse and keyboard'}</p>
        </div>
      </header>

      <p
        role={blocking.length > 0 ? 'alert' : undefined}
        className={cx('flex items-start gap-8 rounded-card px-16 py-12 text-body-sm', blocking.length > 0 ? 'bg-stop-wash text-ink' : 'bg-poured-wash text-ink')}
      >
        {blocking.length > 0 ? (
          <IconAlertTriangle size={16} stroke={ICON_STROKE} className="mt-2 shrink-0 text-stop" aria-hidden="true" />
        ) : (
          <IconCheck size={16} stroke={ICON_STROKE} className="mt-2 shrink-0 text-poured" aria-hidden="true" />
        )}
        {blocking.length > 0 ? 'Not ready for service. Do what is listed below, or use another device.' : 'Ready for service, and keeps taking orders when the Wi-Fi drops.'}
      </p>

      {notes.length > 0 ? (
        <ul className="flex flex-col" aria-label="To do on this device">
          {notes.map((c) => (
            <li key={c.key} className="flex items-start gap-12 border-t border-rule py-12 first:border-t-0 first:pt-0">
              <span aria-hidden="true" className={cx('mt-2 flex size-20 shrink-0 items-center justify-center rounded-dot', c.needed ? 'bg-stop-wash text-stop' : 'bg-control text-ink-muted')}>
                <IconAlertTriangle size={12} stroke={2} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-ui text-ink">{c.label}</span>
                <span className="text-body-sm text-ink-muted">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-12 border-t border-rule pt-16">
        <div className="flex items-baseline justify-between gap-12">
          <h3 className="text-title-card text-ink">How the screen looks</h3>
          {display.chosen !== null ? (
            <button type="button" onClick={() => setDisplay(null)} className="rounded-sm text-body-sm text-accent-text transition-hover hover:text-ink">
              Use the suggestion
            </button>
          ) : (
            <span className="text-body-sm text-ink-muted">{display.suggested.length > 0 ? 'Suggested for this device' : 'Standard'}</span>
          )}
        </div>
        {(['lite', 'clarity'] as const).map((p) => (
          <Switch key={p} checked={display.active.includes(p)} onChange={(on) => toggle(p, on)} label={PROFILE_COPY[p].label} helper={PROFILE_COPY[p].helper} />
        ))}
      </div>
    </section>
  );
}
