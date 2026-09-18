import { memo } from 'react';

/* ============================================================================
 * AmbientFloorArtwork — "Frost & Liquid Architecture"
 *
 * Combining the highly abstract, volumetric "Liquid Architecture" on the left 
 * flank (sweeping decanter, coupe, and vapor ribbon) with the generative 
 * frost crystals on the right flank to tie the design language together beautifully.
 * ========================================================================== */

const RAD = Math.PI / 180;
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

function grow(x: number, y: number, ang: number, len: number, width: number, depth: number, plan: SnowflakePlan, out: OutData) {
  const x2 = x + Math.cos(ang * RAD) * len;
  const y2 = y + Math.sin(ang * RAD) * len;

  out.segments.push({ d: `M${x.toFixed(2)} ${y.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`, w: width, depth });
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

const hexPath = (r: number, phase = 0) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (phase + 60 * i) * RAD;
    return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + ' Z';

const HABITS: Record<string, SnowflakePlan> = {
  dendrite: {
    width: 2.3,
    core: 13,
    levels: [
      [{ at: 0.30, scale: 0.40 }, { at: 0.52, scale: 0.32 }, { at: 0.74, scale: 0.21 }],
      [{ at: 0.46, scale: 0.34 }],
    ],
  },
  sectored: {
    width: 2.4,
    core: 22,
    plates: [{ at: 0.45, r: 18 }, { at: 0.85, r: 10 }],
    levels: [
      [{ at: 0.25, scale: 0.50 }, { at: 0.55, scale: 0.35 }, { at: 0.80, scale: 0.20 }],
      [{ at: 0.40, scale: 0.35 }, { at: 0.70, scale: 0.25 }],
    ],
  }
};

const FLAKES = [
  { id: 'f1', habit: 'dendrite', r: 170, x: 160, y: 210, rot: 15, o: 0.75 },
  { id: 'f2', habit: 'sectored', r: 120, x: 530, y: 810, rot: -25, o: 0.5 }
];

const USED = new Set(FLAKES.map((f) => f.habit));
const ARMS = Object.entries(HABITS)
  .filter(([name]) => USED.has(name))
  .map(([name, plan]) => ({ name, plan, ...buildArm(plan) }));

// -----------------------------------------------------------------------------
// Abstract Liquid Architecture Helpers
// -----------------------------------------------------------------------------

function generateRibbon(cx: number, cy: number) {
  return `M${cx} ${cy} C${cx - 150} ${cy - 100}, ${cx + 250} ${cy - 250}, ${cx - 50} ${cy - 450} C${cx - 250} ${cy - 600}, ${cx - 50} ${cy - 750}, ${cx + 150} ${cy - 900}`;
}

export const AmbientFloorArtwork = memo(function AmbientFloorArtwork() {
  const arms = ARMS;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-24 mix-blend-screen">
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 h-full w-full scale-x-[-1]"
        viewBox="0 0 1600 960"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="frost-rib" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.85" />
            <stop offset="55%" stopColor="var(--color-glint)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="frost-halo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="facet-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.22" />
            <stop offset="50%" stopColor="var(--color-accent)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.03" />
          </linearGradient>

          <linearGradient id="glass-curve" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.9" />
            <stop offset="40%" stopColor="var(--color-glint)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="ribbon-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0" />
            <stop offset="40%" stopColor="var(--color-accent)" stopOpacity="0.4" />
            <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="liquid-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.1" />
            <stop offset="80%" stopColor="var(--color-accent)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="floor-flare-left" cx="4%" cy="70%" r="48%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="floor-flare-right" cx="94%" cy="30%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>

          <filter id="floor-blur-soft">
            <feGaussianBlur stdDeviation="60" />
          </filter>
          <filter id="floor-blur-medium">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="floor-blur-heavy">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="glow-arm" filterUnits="userSpaceOnUse" x="-30" y="-90" width="170" height="180">
            <feGaussianBlur stdDeviation="4" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {arms.map((arm) => (
            <g id={`frost-arm-${arm.name}`} key={arm.name}>
              <g stroke="url(#frost-halo)" strokeLinecap="round" strokeOpacity="0.3">
                {arm.segments.map((s, i) => (<path key={`h${i}`} d={s.d} strokeWidth={s.w * 3.2} />))}
              </g>
              <g stroke="url(#frost-rib)" strokeLinecap="round">
                {arm.segments.map((s, i) => (<path key={`r${i}`} d={s.d} strokeWidth={s.w} strokeOpacity={0.9 - s.depth * 0.12} />))}
              </g>
              <g stroke="var(--color-glint)" strokeLinecap="round">
                {arm.segments.map((s, i) => (<path key={`c${i}`} d={s.d} strokeWidth={s.w * 0.3} strokeOpacity={1.0 - s.depth * 0.1} />))}
              </g>
              {arm.plan.plates?.map((p, i) => (
                <g key={`p${i}`} transform={`translate(${(100 * p.at).toFixed(2)} 0)`}>
                  <path d={hexPath(p.r)} fill="url(#facet-face)" />
                  <path d={hexPath(p.r)} stroke="var(--color-accent)" strokeWidth={arm.plan.width * 0.6} strokeOpacity="0.8" />
                </g>
              ))}
              <g>
                <g fill="var(--color-accent)" fillOpacity="0.4" filter="url(#glow-arm)">
                  {arm.nodes.map((n, i) => (<circle key={`ng${i}`} cx={n.x} cy={n.y} r={n.r * 1.8} />))}
                </g>
                <g fill="var(--color-glint)">
                  {arm.nodes.map((n, i) => (<circle key={`nc${i}`} cx={n.x} cy={n.y} r={n.r * 0.8} />))}
                </g>
              </g>
            </g>
          ))}

          {arms.map(({ name, plan }) => (
            <g id={`frost-core-${name}`} key={`core-${name}`}>
              <path d={hexPath(plan.core)} fill="url(#facet-face)" />
              <path d={hexPath(plan.core)} stroke="var(--color-accent)" strokeWidth={plan.width * 0.8} strokeOpacity="0.8" />
              <circle cx="0" cy="0" r={plan.width * 0.5} fill="var(--color-glint)" />
            </g>
          ))}
        </defs>

        <rect width="100%" height="100%" fill="url(#floor-flare-left)" filter="url(#floor-blur-soft)" />
        <rect width="100%" height="100%" fill="url(#floor-flare-right)" filter="url(#floor-blur-soft)" />

        {/* ── Left Flank (Generative Frost rendering on right side of screen) ── */}
        <g>
          {FLAKES.map((f) => (
            <g key={f.id} transform={`translate(${f.x} ${f.y})`}>
              <g transform={`rotate(${f.rot}) scale(${(f.r / 100).toFixed(4)})`} opacity={f.o}>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <use key={a} href={`#frost-arm-${f.habit}`} transform={`rotate(${a})`} />
                ))}
                <use href={`#frost-core-${f.habit}`} />
              </g>
            </g>
          ))}
        </g>

        {/* ── Right Flank: Deconstructed Glassware & Liquid (renders on left side of screen) ── */}
        <g transform="translate(1560, 840)">
          {/* The Ribbon (Vapor/Peel) weaving through the glasses */}
          <path d={generateRibbon(120, 50)} fill="none" stroke="url(#ribbon-gradient)" strokeWidth="3" strokeLinecap="round" filter="url(#floor-blur-heavy)" opacity="0.3" />
          <path d={generateRibbon(120, 50)} fill="none" stroke="url(#ribbon-gradient)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

          {/* Abstract Decanter / Tall Glass Silhouette */}
          <g transform="translate(-180, -120) rotate(16)">
            {/* Massive sweeping left profile */}
            <path d="M0 -450 C0 -250, -120 -150, -120 0" fill="none" stroke="url(#glass-curve)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M0 -450 C0 -250, -120 -150, -120 0" fill="none" stroke="var(--color-glint)" strokeWidth="5" strokeOpacity="0.1" strokeLinecap="round" filter="url(#floor-blur-medium)" />
            
            {/* Intersecting Liquid Meniscus (Concentric ellipses) */}
            <ellipse cx="-65" cy="-180" rx="95" ry="26" fill="url(#liquid-glow)" stroke="var(--color-accent)" strokeWidth="1.5" strokeOpacity="0.6" />
            <ellipse cx="-65" cy="-180" rx="75" ry="18" fill="none" stroke="var(--color-glint)" strokeWidth="0.8" strokeOpacity="0.5" />
            <ellipse cx="-65" cy="-180" rx="40" ry="8" fill="none" stroke="var(--color-accent)" strokeWidth="0.5" strokeOpacity="0.4" />
            
            {/* Decanter Base reflection */}
            <path d="M-120 0 C-60 15, 0 15, 60 0" fill="none" stroke="var(--color-glint)" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" />
            <circle cx="-120" cy="0" r="2.5" fill="var(--color-glint)" fillOpacity="0.8" />
          </g>

          {/* Abstract Coupe Silhouette */}
          <g transform="translate(40, -40) rotate(-14)">
            {/* Coupe Bowl Sweep */}
            <path d="M-100 -220 C-100 -80, 80 -80, 80 -220" fill="url(#liquid-glow)" fillOpacity="0.6" stroke="url(#glass-curve)" strokeWidth="1.5" strokeLinecap="round" />
            
            {/* Coupe Stem & Geometric Foot */}
            <line x1="-10" y1="-115" x2="-10" y2="20" stroke="var(--color-glint)" strokeWidth="1.8" strokeOpacity="0.75" />
            <ellipse cx="-10" cy="20" rx="60" ry="14" fill="none" stroke="var(--color-glint)" strokeWidth="1" strokeOpacity="0.6" />
            
            {/* Coupe Liquid Surface (Tilted for perspective) */}
            <g transform="translate(-10, -195) rotate(-4)">
              <ellipse cx="0" cy="0" rx="85" ry="22" fill="var(--color-accent)" fillOpacity="0.15" stroke="var(--color-accent)" strokeWidth="1.2" strokeOpacity="0.8" />
              <ellipse cx="0" cy="0" rx="70" ry="16" fill="none" stroke="var(--color-glint)" strokeWidth="0.5" strokeOpacity="0.6" />
              <path d="M-85 0 A85 22 0 0 0 85 0" fill="none" stroke="var(--color-glint)" strokeWidth="2" strokeOpacity="0.5" filter="url(#floor-blur-medium)" />
            </g>

            {/* Specular droplets / effervescence */}
            <circle cx="-50" cy="-280" r="4.5" fill="var(--color-glint)" fillOpacity="0.8" filter="url(#floor-blur-medium)" />
            <circle cx="-50" cy="-280" r="1.5" fill="var(--color-glint)" fillOpacity="1" />
            <circle cx="-80" cy="-210" r="2" fill="var(--color-glint)" fillOpacity="0.9" />
            <circle cx="60" cy="-200" r="2.5" fill="var(--color-glint)" fillOpacity="0.7" />
          </g>
        </g>
      </svg>
    </div>
  );
});