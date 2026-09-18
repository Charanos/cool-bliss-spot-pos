import { memo } from 'react';

/* ============================================================================
 * AmbientTerminalArtwork — "Posh Crystal Frost"
 *
 * Snow crystals are not drawn here, they are generated.
 *
 *  · D₆ symmetry: one arm is built, then instanced at 0/60/…/300°. The six-fold
 *    symmetry is therefore structural — it cannot drift out of register.
 *  · 60° forks: side branches leave their parent at exactly ±60°, because real
 *    dendrites grow along the six equivalent a-axes of the hexagonal lattice.
 *    Every fork in this file, at every depth, uses that one angle.
 *  · Corner nucleation: arms spring from the vertices of the central hexagonal
 *    plate, so the plate is drawn vertex-aligned to the arms (phase 0), not
 *    edge-aligned.
 *  · Each arm is authored once at unit length 100 and scaled per flake, so
 *    stroke weight thins with distance and gives depth for free.
 * ========================================================================== */

const RAD = Math.PI / 180;

/** The crystallographic branch angle. This is the whole geometry. */
const FORK = 60;

interface SnowflakePlan {
  width: number;
  core: number;
  rings?: number[];
  plates?: { at: number; r: number; }[];
  levels: { at: number; scale: number; }[][];
}

interface OutData {
  segments: { d: string; w: number; depth: number; }[];
  nodes: { x: number; y: number; r: number; depth: number; }[];
  joints: { x: number; y: number; r: number; }[];
}

/** Recursively grow one arm. Every child leaves its parent at ±FORK. */
function grow(x: number, y: number, ang: number, len: number, width: number, depth: number, plan: SnowflakePlan, out: OutData) {
  const x2 = x + Math.cos(ang * RAD) * len;
  const y2 = y + Math.sin(ang * RAD) * len;

  out.segments.push({
    d: `M${x.toFixed(2)} ${y.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`,
    w: width,
    depth,
  });
  out.nodes.push({ x: x2, y: y2, r: width * 0.85, depth });

  const children = plan.levels[plan.levels.length - 1 - depth];
  if (!children || depth <= 0) return;

  for (const c of children) {
    const bx = x + Math.cos(ang * RAD) * len * c.at;
    const by = y + Math.sin(ang * RAD) * len * c.at;
    out.joints.push({ x: bx, y: by, r: width * 0.55 });
    for (const side of [1, -1]) {
      grow(bx, by, ang + side * FORK, len * c.scale, width * 0.6, depth - 1, plan, out);
    }
  }
}

function buildArm(plan: SnowflakePlan) {
  const out: OutData = { segments: [], nodes: [], joints: [] };
  grow(0, 0, 0, 100, plan.width, plan.levels.length - 1, plan, out);
  return out;
}

/** Regular hexagon, vertex-aligned to the arms (phase 0). */
const hexPath = (r: number, phase: number = 0) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (phase + 60 * i) * RAD;
    return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + ' Z';

/* ---------------------------------------------------------------------------
 * Four crystal habits, after the real classification. All at unit length 100.
 * ------------------------------------------------------------------------- */

const HABITS: Record<string, SnowflakePlan> = {
  /* Stellar dendrite — the showpiece. Two orders of branching. */
  dendrite: {
    width: 2.3,
    core: 13,
    levels: [
      [{ at: 0.30, scale: 0.40 }, { at: 0.52, scale: 0.32 }, { at: 0.74, scale: 0.21 }],
      [{ at: 0.46, scale: 0.34 }],
    ],
  },
  /* Classic snowflake — dense branching and structured core plates. */
  sectored: {
    width: 2.4,
    core: 22,
    plates: [{ at: 0.45, r: 18 }, { at: 0.85, r: 10 }],
    levels: [
      [
        { at: 0.25, scale: 0.50 },
        { at: 0.55, scale: 0.35 },
        { at: 0.80, scale: 0.20 },
      ],
      [
        { at: 0.40, scale: 0.35 },
        { at: 0.70, scale: 0.25 },
      ],
    ],
  },
  /* Intricate star — piercing geometry with tight concentric rings. */
  star: {
    width: 2.8,
    core: 26,
    rings: [26, 16, 8],
    plates: [{ at: 0.60, r: 12 }],
    levels: [
      [
        { at: 0.35, scale: 0.40 },
        { at: 0.75, scale: 0.28 },
      ]
    ],
  },
  /* Hexagonal plate — nested rings and six stubs. Distant flurry. */
  plate: {
    width: 3.4,
    core: 34,
    rings: [34, 22, 12],
    levels: [[]],
  },
};

/* ---------------------------------------------------------------------------
 * Composition. Held to the upper-left of the panel so the heading and the
 * personnel cards stay clear, and cut by the same bottom fade.
 * ------------------------------------------------------------------------- */

interface Flake { id: string; habit: string; r: number; x: number; y: number; rot: number; o: number; spin?: 'slow' | 'reverse'; }
const FLAKES: Flake[] = [
  { id: 'a', habit: 'dendrite', r: 205, x: 5, y: 140, rot: 9, o: 1.0, spin: 'slow' },
  { id: 'b', habit: 'sectored', r: 116, x: 720, y: 480, rot: 25, o: 0.82, spin: 'reverse' },
  { id: 'c', habit: 'dendrite', r: 80, x: 140, y: 680, rot: -18, o: 0.62 },
  { id: 'd', habit: 'star', r: 54, x: 80, y: 570, rot: 14, o: 0.5 },
];

/* Deterministic frost motes — no branching, just caught light. */
const MOTES: [number, number, number][] = [
  [320, 60, 1.6], [40, 150, 1.2], [480, 90, 1.0], [650, 180, 1.4],
  [140, 260, 1.1], [520, 290, 0.9], [40, 520, 1.3], [350, 480, 1.0],
  [620, 550, 1.1], [180, 650, 0.9], [460, 740, 0.8], [80, 750, 0.7],
  [680, 380, 1.0], [420, 820, 0.9], [580, 710, 1.1], [120, 850, 0.8]
];

/** The geometry is pure and never changes, so it is built once per module, not per render. */
const USED = new Set(FLAKES.map((f) => f.habit));
const ARMS = Object.entries(HABITS)
  .filter(([name]) => USED.has(name))
  .map(([name, plan]) => ({ name, plan, ...buildArm(plan) }));

/**
 * Glow is blurred once per arm, over the group of glow dots, instead of once per dot: six blur
 * passes per crystal rather than one for every branch tip. The region is in the arm's own units,
 * sized to the furthest branch plus three standard deviations, so no halo is clipped.
 */
const GLOW_REGION = { x: -30, y: -90, width: 170, height: 180 } as const;

/**
 * The frost is static artwork with no props, so it renders once. Without this, every digit typed on
 * the PIN pad beside it re-rendered several hundred SVG nodes.
 */
export const AmbientTerminalArtwork = memo(function AmbientTerminalArtwork() {
  const arms = ARMS;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-40 mix-blend-screen">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMinYMin slice"
        fill="none"
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>{`
          .bliss-frost-slow { animation: bliss-frost-turn 420s steps(4200) infinite; transform-origin: 0 0; }
          .bliss-frost-reverse { animation: bliss-frost-turn 560s steps(5600) infinite reverse; transform-origin: 0 0; }
          @keyframes bliss-frost-turn { to { transform: rotate(360deg); } }
          @media (prefers-reduced-motion: reduce) {
            .bliss-frost-slow, .bliss-frost-reverse { animation: none; }
          }
        `}</style>

        <defs>
          <linearGradient id="bliss-frost-frost-rib" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.85" />
            <stop offset="55%" stopColor="var(--color-glint)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0.7" />
          </linearGradient>

          <linearGradient id="bliss-frost-frost-halo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.12" />
          </linearGradient>

          <linearGradient id="bliss-frost-facet-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.22" />
            <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.03" />
          </linearGradient>

          <radialGradient id="bliss-frost-glint" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="bliss-frost-frost-bloom" cx="16%" cy="4%" r="74%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>

          <filter id="bliss-frost-blur-soft">
            <feGaussianBlur stdDeviation="50" />
          </filter>

          {/* Per element, for the single glow dot at a crystal's core. */}
          <filter id="bliss-frost-glow-heavy" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Per arm, over every glow dot in the arm at once. */}
          <filter id="bliss-frost-glow-arm" filterUnits="userSpaceOnUse" x={GLOW_REGION.x} y={GLOW_REGION.y} width={GLOW_REGION.width} height={GLOW_REGION.height}>
            <feGaussianBlur stdDeviation="4" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="bliss-frost-fade-mask-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="1" />
            <stop offset="44%" stopColor="var(--color-glint)" stopOpacity="1" />
            <stop offset="80%" stopColor="var(--color-glint)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0" />
          </linearGradient>
          <mask id="bliss-frost-fade-bottom" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="800">
            <rect x="0" y="0" width="1000" height="800" fill="url(#bliss-frost-fade-mask-gradient)" />
          </mask>

          {/* One arm per habit, authored at unit length 100 and instanced six times. */}
          {arms.map((arm) => (
            <g id={`bliss-frost-arm-${arm.name}`} key={arm.name}>
              {/* frosted halo pass */}
              <g stroke="url(#bliss-frost-frost-halo)" strokeLinecap="round" strokeOpacity="0.3">
                {arm.segments.map((s, i) => (
                  <path key={`h${i}`} d={s.d} strokeWidth={s.w * 3.2} />
                ))}
              </g>
              {/* crisp rib pass */}
              <g stroke="url(#bliss-frost-frost-rib)" strokeLinecap="round">
                {arm.segments.map((s, i) => (
                  <path key={`r${i}`} d={s.d} strokeWidth={s.w} strokeOpacity={0.9 - s.depth * 0.12} />
                ))}
              </g>
              {/* ultra-crisp core pass */}
              <g stroke="var(--color-glint)" strokeLinecap="round">
                {arm.segments.map((s, i) => (
                  <path key={`c${i}`} d={s.d} strokeWidth={s.w * 0.3} strokeOpacity={1.0 - s.depth * 0.1} />
                ))}
              </g>
              {/* faceted plates, where the habit calls for them */}
              {arm.plan.plates?.map((p, i) => (
                <g key={`p${i}`} transform={`translate(${(100 * p.at).toFixed(2)} 0)`}>
                  <path d={hexPath(p.r)} fill="url(#bliss-frost-facet-face)" />
                  <path
                    d={hexPath(p.r)}
                    stroke="var(--color-accent)"
                    strokeWidth={arm.plan.width * 0.6}
                    strokeOpacity="0.8"
                  />
                  <path
                    d={hexPath(p.r - arm.plan.width * 0.6)}
                    stroke="var(--color-glint)"
                    strokeWidth={arm.plan.width * 0.2}
                    strokeOpacity="0.9"
                  />
                </g>
              ))}
              {/* junction and tip glints - 4K geometric style */}
              <g>
                {arm.joints.map((n, i) => (
                  <g key={`j${i}`}>
                    <circle cx={n.x} cy={n.y} r={n.r * 3.5} fill="none" stroke="var(--color-accent)" strokeWidth={arm.plan.width * 0.25} strokeOpacity="0.5" />
                    <circle cx={n.x} cy={n.y} r={n.r * 1.5} fill="var(--color-accent)" fillOpacity="0.8" />
                    <circle cx={n.x} cy={n.y} r={n.r * 0.6} fill="var(--color-glint)" />
                  </g>
                ))}
                <g fill="none" stroke="var(--color-accent)" strokeWidth={arm.plan.width * 0.3} strokeOpacity="0.6">
                  {arm.nodes.map((n, i) => (
                    <circle key={`nr${i}`} cx={n.x} cy={n.y} r={n.r * 3.5} />
                  ))}
                </g>
                <g fill="var(--color-accent)" fillOpacity="0.9" filter="url(#bliss-frost-glow-arm)">
                  {arm.nodes.map((n, i) => (
                    <circle key={`ng${i}`} cx={n.x} cy={n.y} r={n.r * 1.8} />
                  ))}
                </g>
                <g fill="var(--color-glint)">
                  {arm.nodes.map((n, i) => (
                    <circle key={`nc${i}`} cx={n.x} cy={n.y} r={n.r * 0.8} />
                  ))}
                </g>
              </g>
            </g>
          ))}

          {/* Central plates, vertex-aligned so arms spring from the corners. */}
          {arms.map(({ name, plan }) => (
            <g id={`bliss-frost-core-${name}`} key={`core-${name}`}>
              <path d={hexPath(plan.core)} fill="url(#bliss-frost-facet-face)" />
              <path d={hexPath(plan.core)} stroke="var(--color-accent)" strokeWidth={plan.width * 0.8} strokeOpacity="0.8" />
              {(plan.rings ?? [plan.core, plan.core * 0.58]).slice(1).map((r, i) => (
                <path key={i} d={hexPath(r)} stroke="var(--color-glint)" strokeWidth={plan.width * 0.35} strokeOpacity="0.6" />
              ))}
              <circle cx="0" cy="0" r={plan.width * 1.8} fill="none" stroke="var(--color-accent)" strokeWidth={plan.width * 0.4} strokeOpacity="0.6" />
              <circle cx="0" cy="0" r={plan.width * 1.2} fill="var(--color-accent)" fillOpacity="0.9" filter="url(#bliss-frost-glow-heavy)" />
              <circle cx="0" cy="0" r={plan.width * 0.5} fill="var(--color-glint)" />
            </g>
          ))}
        </defs>

        <rect width="100%" height="100%" fill="url(#bliss-frost-frost-bloom)" filter="url(#bliss-frost-blur-soft)" />

        <g mask="url(#bliss-frost-fade-bottom)">
          {FLAKES.map((f) => {
            const spin =
              f.spin === 'slow' ? 'bliss-frost-slow' : f.spin === 'reverse' ? 'bliss-frost-reverse' : null;
            const body = (
              <g transform={`rotate(${f.rot}) scale(${(f.r / 100).toFixed(4)})`} opacity={f.o}>
                {/* D₆: the same arm, six times. */}
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <use key={a} href={`#bliss-frost-arm-${f.habit}`} transform={`rotate(${a})`} />
                ))}
                <use href={`#bliss-frost-core-${f.habit}`} />
              </g>
            );
            return (
              <g key={f.id} transform={`translate(${f.x} ${f.y})`}>
                {spin ? <g className={spin}>{body}</g> : body}
              </g>
            );
          })}

          {/* distant flurry */}
          <g>
            {MOTES.map(([x, y, r], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={r * 3.4} fill="url(#bliss-frost-glint)" />
                <circle cx={x} cy={y} r={r * 0.62} fill="var(--color-glint)" fillOpacity="0.75" />
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
});
