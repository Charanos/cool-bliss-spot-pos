'use client';

import { Switch } from '@bliss/ui/components/fields';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertTriangle, IconCheck, IconDeviceDesktop, IconDeviceTablet, IconMinus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { CHECKS, type DeviceCaps, type DisplayProfile, readCaps } from '@/lib/pos/device-caps';
import { setDisplay, useDisplay } from '@/lib/pos/display';

const PROFILE_COPY: Record<Exclude<DisplayProfile, 'standard'>, { label: string; helper: string }> = {
  lite: { label: 'Lite', helper: 'Solid surfaces instead of frosted glass, no background artwork, short motion. Faster on older tablets.' },
  clarity: { label: 'Clarity', helper: 'Clearer steps between surfaces, visible edges and stronger colours, for screens that wash colour out.' },
};

/**
 * This device: what it is, whether it runs Bliss properly, and how Bliss draws on it. The first thing
 * to open on a new tablet or till, and the check to read when something looks wrong. docs/16 section 1.
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
  const Glyph = caps.pointer === 'touch' ? IconDeviceTablet : IconDeviceDesktop;

  const toggle = (profile: Exclude<DisplayProfile, 'standard'>, on: boolean) => {
    const current = new Set(display.active);
    if (on) current.add(profile);
    else current.delete(profile);
    setDisplay([...current]);
  };

  return (
    <section aria-labelledby="device-title" className="flex flex-col gap-20 rounded-card border border-rule-raised bg-raised p-20">
      <header className="flex items-start gap-12">
        <span aria-hidden="true" className="flex size-control-md shrink-0 items-center justify-center rounded-md text-ink-muted">
          <Glyph size={20} stroke={ICON_STROKE} />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 id="device-title" className="text-title-section text-ink">
            This device
          </h2>
          <p className="text-body-sm text-ink-muted">
            {caps.browser} on {caps.system}, {caps.viewport} at {caps.dpr}×, {caps.pointer === 'touch' ? 'touch' : 'mouse and keyboard'}
          </p>
        </div>
      </header>

      {blocking.length > 0 ? (
        <p role="alert" className="flex items-start gap-8 rounded-md bg-stop-wash px-12 py-12 text-body-sm text-ink">
          <IconAlertTriangle size={16} stroke={ICON_STROKE} className="mt-2 shrink-0 text-stop" aria-hidden="true" />
          This device cannot run everything Bliss needs. Update its system and browser, or use another device for service.
        </p>
      ) : null}

      <ul className="flex flex-col" aria-label="Checks">
        {CHECKS.map((c) => {
          const ok = caps.checks[c.key];
          return (
            <li key={c.key} className="flex items-start gap-12 border-t border-rule py-12 first:border-t-0 first:pt-0">
              <span
                aria-hidden="true"
                className={cx(
                  'mt-2 flex size-20 shrink-0 items-center justify-center rounded-dot',
                  ok ? 'bg-poured-wash text-poured' : c.needed ? 'bg-stop-wash text-stop' : 'bg-control text-ink-muted',
                )}
              >
                {ok ? <IconCheck size={13} stroke={2.25} /> : c.needed ? <IconAlertTriangle size={12} stroke={2} /> : <IconMinus size={13} stroke={2} />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-ui text-ink">
                  {c.label}
                  <span className="sr-only">{ok ? ', yes' : c.needed ? ', no, needed' : ', not on this device'}</span>
                </span>
                <span className="text-body-sm text-ink-muted">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-12 border-t border-rule pt-16">
        <div className="flex items-baseline justify-between gap-12">
          <h3 className="text-title-card text-ink">How Bliss draws here</h3>
          {display.chosen !== null ? (
            <button type="button" onClick={() => setDisplay(null)} className="rounded-sm text-body-sm text-accent-text transition-hover hover:text-ink">
              Follow this device
            </button>
          ) : (
            <span className="text-body-sm text-ink-muted">{display.suggested.length > 0 ? `Suggested for this device` : 'Standard, as drawn'}</span>
          )}
        </div>
        {(['lite', 'clarity'] as const).map((p) => (
          <Switch key={p} checked={display.active.includes(p)} onChange={(on) => toggle(p, on)} label={PROFILE_COPY[p].label} helper={PROFILE_COPY[p].helper} />
        ))}
      </div>
    </section>
  );
}
