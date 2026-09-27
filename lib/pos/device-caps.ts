'use client';

/**
 * What this device is and what it can do, read in the browser. Shown on the station's "This device"
 * card, and sent with the sync pull so the Console's device record shows it too. docs/16 section 1.
 *
 * Nothing here identifies a person: an engine, a screen and a handful of feature checks.
 */

export interface DeviceCaps {
  /** "Safari 15.6", "Chrome 124", or the engine's own words when neither is recognised. */
  browser: string;
  /** "iPadOS 15.8", "Windows", "macOS", "Android 13". */
  system: string;
  viewport: string;
  dpr: number;
  orientation: 'portrait' | 'landscape';
  /** The widest colour range the screen shows. */
  gamut: 'srgb' | 'p3' | 'rec2020';
  hdr: boolean;
  pointer: 'touch' | 'mouse';
  cores: number | null;
  /** Gigabytes, rounded by the browser; Chrome only. */
  memory: number | null;
  reducedMotion: boolean;
  moreContrast: boolean;
  checks: Record<CheckKey, boolean>;
}

export type CheckKey = 'modern' | 'tint' | 'blur' | 'storage' | 'offline' | 'wakeLock';

/** Each check, in the words a manager reads, and whether Bliss needs it or only uses it when there. */
export const CHECKS: { key: CheckKey; label: string; needed: boolean; detail: string }[] = [
  { key: 'modern', label: 'Runs Bliss', needed: true, detail: 'Safari 15.4 or Chrome 111 and newer' },
  { key: 'storage', label: 'Keeps orders on the device', needed: true, detail: 'IndexedDB, for working through a dropped connection' },
  { key: 'offline', label: 'Opens without a connection', needed: true, detail: 'A service worker, which serves Bliss when the Wi-Fi drops' },
  { key: 'tint', label: 'Soft colour tints', needed: false, detail: 'Read directly, or through the build fallback on older Safari' },
  { key: 'blur', label: 'Frosted glass', needed: false, detail: 'Behind sheets everywhere; Lite keeps small surfaces solid on slower devices' },
  { key: 'wakeLock', label: 'Keeps the screen awake', needed: false, detail: 'Otherwise set Auto-Lock to Never in the device settings' },
];

function media(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function browserOf(ua: string): string {
  const edge = /Edg\/(\d+)/.exec(ua);
  if (edge) return `Edge ${edge[1]}`;
  const chrome = /(?:Chrome|CriOS)\/(\d+)/.exec(ua);
  if (chrome) return `Chrome ${chrome[1]}`;
  const firefox = /(?:Firefox|FxiOS)\/(\d+)/.exec(ua);
  if (firefox) return `Firefox ${firefox[1]}`;
  const safari = /Version\/(\d+(?:\.\d+)?)[^]*Safari/.exec(ua);
  if (safari) return `Safari ${safari[1]}`;
  return 'Unrecognised browser';
}

function systemOf(ua: string): string {
  const ios = /(?:CPU (?:iPhone )?OS|iPad; CPU OS) (\d+)_(\d+)/.exec(ua);
  if (ios) return `${/iPad/.test(ua) ? 'iPadOS' : 'iOS'} ${ios[1]}.${ios[2]}`;
  // iPadOS 13 and later can ask for the desktop site, and then say Macintosh; touch gives it away.
  if (/Macintosh/.test(ua)) return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
  const android = /Android (\d+)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown system';
}

/** Read the device now. Safe to call during render on the client only. */
export function readCaps(): DeviceCaps {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { deviceMemory?: number; wakeLock?: unknown };
  const supports = (property: string, value: string) => typeof CSS !== 'undefined' && CSS.supports(property, value);
  const browser = browserOf(ua);
  const [engine, version] = [browser.split(' ')[0], Number.parseFloat(browser.split(' ')[1] ?? '0')];
  const modern = (engine === 'Safari' && version >= 15.4) || (['Chrome', 'Edge'].includes(engine ?? '') && version >= 111) || (engine === 'Firefox' && version >= 111);
  return {
    browser,
    system: systemOf(ua),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    orientation: window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape',
    gamut: media('(color-gamut: rec2020)') ? 'rec2020' : media('(color-gamut: p3)') ? 'p3' : 'srgb',
    hdr: media('(dynamic-range: high)'),
    pointer: media('(pointer: coarse)') ? 'touch' : 'mouse',
    cores: navigator.hardwareConcurrency || null,
    memory: nav.deviceMemory ?? null,
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    moreContrast: media('(prefers-contrast: more)'),
    checks: {
      modern,
      // Tints are rgb() with channels after the build, so they read wherever rgb() with an alpha does.
      // eslint-disable-next-line bliss/no-raw-hex -- a feature test, not a colour anyone sees
      tint: supports('color', 'rgb(1 2 3 / 50%)'),
      blur: supports('backdrop-filter', 'blur(2px)') || supports('-webkit-backdrop-filter', 'blur(2px)'),
      storage: typeof indexedDB !== 'undefined',
      offline: 'serviceWorker' in navigator,
      wakeLock: Boolean(nav.wakeLock),
    },
  };
}

export type DisplayProfile = 'standard' | 'lite' | 'clarity';

/**
 * The profile a device suits, by what it reports: every station starts in Clarity, and a slow device
 * adds Lite. A suggestion only; the device or a manager decides. docs/06, profiles.
 */
export function suggestProfiles(caps: DeviceCaps): DisplayProfile[] {
  const out: DisplayProfile[] = [];
  const oldSafari = caps.browser.startsWith('Safari') && Number.parseFloat(caps.browser.split(' ')[1] ?? '99') < 16;
  if (oldSafari || (caps.cores !== null && caps.cores <= 2) || (caps.memory !== null && caps.memory <= 2)) out.push('lite');
  // Clarity reads well on every screen we have tried, good and weak alike, so every station starts in it.
  out.push('clarity');
  return out;
}

/** A compact copy for the sync pull: the Console shows it on the device's record. */
export function capsForServer(caps: DeviceCaps, display: readonly DisplayProfile[]): string {
  const failed = (Object.keys(caps.checks) as CheckKey[]).filter((k) => !caps.checks[k]);
  return JSON.stringify({
    b: caps.browser,
    s: caps.system,
    v: caps.viewport,
    r: caps.dpr,
    g: caps.gamut,
    p: caps.pointer,
    c: caps.cores,
    m: caps.memory,
    f: failed,
    d: display,
  });
}
