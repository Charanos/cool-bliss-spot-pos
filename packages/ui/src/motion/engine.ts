import { gsap } from 'gsap';
import { motion as motionTokens } from '../tokens/tokens';
import { bezierFromCss } from './bezier';
import { type AnimationName, type EaseName, MAX_CONCURRENT, registry } from './registry';

/**
 * The motion engine. docs/07-motion-and-interaction.md section 4 and ADR-015.
 *
 * GSAP is the only animation library and every animation goes through `play`, which:
 *  - takes its duration and curve from the registry, never from the call site
 *  - makes reduced motion instant, keeping opacity fades at 80ms
 *  - completes the previous animation in the same lane instead of queueing
 *  - caps concurrency per surface (three on the Floor)
 *  - records name, duration and longest frame for the debug panel
 */

export const ease: Record<EaseName, (t: number) => number> = {
  out: bezierFromCss(motionTokens.ease.out),
  in: bezierFromCss(motionTokens.ease.in),
  inOut: bezierFromCss(motionTokens.ease.inOut),
  snap: bezierFromCss(motionTokens.ease.snap),
};

export interface MotionLogEntry {
  name: AnimationName;
  ms: number;
  longestFrameMs: number;
  at: number;
}

export interface MotionState {
  /** The operating system asks for reduced motion. */
  systemReduced: boolean;
  /** Forced from the debug panel, to test the branch without changing OS settings. */
  forcedReduced: boolean;
  /** Every animation applies its end state immediately. The honest test of the system. */
  off: boolean;
  /** Battery below 15 per cent: a tablet at midnight needs to take orders, not to look nice. */
  lowPower: boolean;
  timeScale: number;
  highlight: boolean;
  log: MotionLogEntry[];
}

let state: MotionState = {
  systemReduced: false,
  forcedReduced: false,
  off: false,
  lowPower: false,
  timeScale: 1,
  highlight: false,
  log: [],
};

const listeners = new Set<() => void>();

export const motionStore = {
  get: (): MotionState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(patch: Partial<MotionState>): void {
    state = { ...state, ...patch };
    if (patch.timeScale !== undefined) gsap.globalTimeline.timeScale(Math.max(0.05, patch.timeScale));
    if (patch.highlight !== undefined && typeof document !== 'undefined') {
      document.documentElement.toggleAttribute('data-motion-highlight', patch.highlight);
    }
    for (const l of listeners) l();
  },
};

export const isInstant = () => state.off || state.lowPower;
export const isReduced = () => state.systemReduced || state.forcedReduced;

let initialised = false;

/** Register defaults once, at the application root of each surface. */
export function initMotion(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  // force3D ensures GSAP always uses translate3d/matrix3d — GPU-composited paths only.
  gsap.defaults({ duration: 0.16, ease: ease.out, overwrite: 'auto', force3D: true });
  gsap.globalTimeline.timeScale(1);
  // Smooth over hiccups up to 500ms; clamp the simulated delta to 33ms so missed frames
  // don't cause a visible "jump" on a busy POS tablet.
  gsap.ticker.lagSmoothing(500, 33);

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: reduce)', () => {
    motionStore.set({ systemReduced: true });
    return () => motionStore.set({ systemReduced: false });
  });

  type BatteryManager = EventTarget & { level: number; charging: boolean };
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
  nav
    .getBattery?.()
    .then((battery) => {
      const check = () => {
        const low = !battery.charging && battery.level < 0.15;
        motionStore.set({ lowPower: low });
        // Cap the GSAP ticker to 60fps on low power; ProMotion (120Hz) iPads burn
        // significantly more energy running animations at their native refresh rate.
        if (low) gsap.ticker.fps(60);
        else gsap.ticker.fps(-1); // -1 = use requestAnimationFrame natively
      };
      check();
      battery.addEventListener('levelchange', check);
      battery.addEventListener('chargingchange', check);
    })
    .catch(() => undefined);
}

const TRANSFORM_KEYS = ['x', 'y', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'rotation', 'transformOrigin'] as const;
const REDUCED_FADE_S = 0.08;

type TweenVars = gsap.TweenVars;

/**
 * Vars for a registered animation. Duration and ease come from the registry. Under reduced motion,
 * transforms are dropped and any opacity change runs at 80ms.
 */
export function vars(name: AnimationName, extra: TweenVars = {}): TweenVars {
  const spec = registry[name];
  const out: TweenVars = { ...extra, duration: spec.ms / 1000, ease: ease[spec.ease] };
  if (isReduced()) {
    for (const key of TRANSFORM_KEYS) delete out[key];
    delete out.stagger;
    out.duration = 'opacity' in extra ? REDUCED_FADE_S : 0;
  }
  return out;
}

/**
 * Starting values for a fromTo. Under reduced motion transforms are dropped here too, otherwise an
 * element would be left at its starting transform, such as a chart bar stuck at scaleY 0.
 */
export function fromVars(start: TweenVars): TweenVars {
  if (!isReduced()) return start;
  const out: TweenVars = { ...start };
  for (const key of TRANSFORM_KEYS) delete out[key];
  return out;
}

/** Override duration and stagger for a staggered group, unless reduced motion has taken over. */
export function staggered(base: TweenVars, eachSeconds: number, staggerSeconds: number): TweenVars {
  if (isReduced()) return base;
  return { ...base, duration: eachSeconds, stagger: staggerSeconds };
}

/**
 * Split a total budget across a group: each item's duration and the stagger between items, so the
 * whole group finishes inside the registry duration however many items there are.
 */
export function splitBudget(totalSeconds: number, count: number, preferredStagger: number, minEach = 0.04) {
  if (count <= 1) return { each: totalSeconds, stagger: 0 };
  const stagger = Math.min(preferredStagger, (totalSeconds - minEach) / (count - 1));
  const each = Math.max(minEach, totalSeconds - stagger * (count - 1));
  return { each, stagger };
}

const lanes = new Map<string, gsap.core.Animation>();
const running = new Map<string, gsap.core.Animation[]>();

function finish(animation: gsap.core.Animation) {
  animation.progress(1);
  animation.kill();
}

export interface PlayOptions {
  targets?: Element | Element[] | null;
  onDone?: () => void;
}

/**
 * Play a registered animation. `build` receives nothing and returns a GSAP animation built with
 * `vars(name, ...)`. The engine owns lanes, concurrency, instant mode and the debug log.
 */
export function play(name: AnimationName, build: () => gsap.core.Animation | null, options: PlayOptions = {}): gsap.core.Animation | null {
  const spec = registry[name];
  const laneKey = `${spec.surface}:${spec.lane}`;

  const previous = lanes.get(laneKey);
  if (previous) finish(previous);

  const animation = build();
  if (!animation) {
    options.onDone?.();
    return null;
  }

  if (isInstant()) {
    finish(animation);
    options.onDone?.();
    return null;
  }

  const list = running.get(spec.surface) ?? [];
  while (list.length >= MAX_CONCURRENT[spec.surface]) {
    const oldest = list.shift();
    if (oldest) finish(oldest);
  }
  list.push(animation);
  running.set(spec.surface, list);
  lanes.set(laneKey, animation);

  const targets = options.targets ? (Array.isArray(options.targets) ? options.targets : [options.targets]) : [];

  // Promote targets to their own compositor layer before the first frame.
  // This avoids the browser promoting mid-animation, which causes a flash.
  for (const t of targets) (t as HTMLElement).style.willChange = 'transform, opacity';

  if (state.highlight) for (const t of targets) t.setAttribute('data-animating', '');

  let last = performance.now();
  let longest = 0;
  const onUpdate = () => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
  };
  const cleanup = () => {
    for (const t of targets) {
      t.removeAttribute('data-animating');
      // Demote the layer after animation — prevents GPU memory from accumulating on a
      // tablet that's been running for an 8-hour shift without a page reload.
      (t as HTMLElement).style.willChange = '';
    }
    const current = running.get(spec.surface);
    if (current) running.set(spec.surface, current.filter((a) => a !== animation));
    if (lanes.get(laneKey) === animation) lanes.delete(laneKey);
    const entry: MotionLogEntry = { name, ms: spec.ms, longestFrameMs: Math.round(longest), at: Date.now() };
    motionStore.set({ log: [entry, ...state.log].slice(0, 50) });
    if (process.env.NODE_ENV !== 'production' && longest > 17) {
      console.debug(`[motion] ${name} dropped a frame: ${Math.round(longest)}ms`);
    }
  };

  // Chain, never replace: a tween may carry its own onUpdate, such as a count driving a figure.
  const ownUpdate = animation.eventCallback('onUpdate');
  const ownComplete = animation.eventCallback('onComplete');
  animation.eventCallback('onUpdate', function (this: gsap.core.Animation, ...args: unknown[]) {
    onUpdate();
    ownUpdate?.apply(this, args);
  });
  animation.eventCallback('onComplete', function (this: gsap.core.Animation, ...args: unknown[]) {
    ownComplete?.apply(this, args);
    cleanup();
    options.onDone?.();
  });
  animation.eventCallback('onInterrupt', () => {
    cleanup();
    options.onDone?.();
  });
  return animation;
}

export { gsap };
