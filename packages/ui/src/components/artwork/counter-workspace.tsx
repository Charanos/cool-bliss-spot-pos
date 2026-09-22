import { memo } from 'react';

/* ============================================================================
 * AmbientCounterArtwork — "Pour and Ledger"
 *
 * The Counter's sibling to the Floor's "Frost and Liquid Architecture". Same drawing language:
 * hairline glass, glint highlights, one frost crystal, soft flares. Warmed with the ember money
 * tone, because this is the station where drinks are poured and bills are paid.
 *
 *   left flank    a tap's pour stream falling into a highball, with rising bubbles
 *   right flank   a till receipt curling away, its ruled lines fading, and a sectored crystal
 *
 * Static and memoised: it draws once and never re-renders with the view above it.
 * ========================================================================== */

const RAD = Math.PI / 180;

const hexPath = (r: number, phase = 0) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (phase + 60 * i) * RAD;
    return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  }).join(' ') + ' Z';

/** One arm of a sectored crystal: a rib, two plates and three pairs of short branches. */
function crystalArm() {
  const parts: string[] = ['M0 0 L100 0'];
  for (const [at, len] of [
    [0.3, 34],
    [0.55, 26],
    [0.8, 16],
  ] as const) {
    const x = 100 * at;
    for (const side of [1, -1]) {
      const x2 = x + Math.cos(60 * RAD) * len;
      const y2 = side * Math.sin(60 * RAD) * len;
      parts.push(`M${x.toFixed(2)} 0 L${x2.toFixed(2)} ${y2.toFixed(2)}`);
    }
  }
  return parts.join(' ');
}

const ARM = crystalArm();

/** Bubbles rising in the glass: position, radius, opacity. Fixed, so the drawing never shifts. */
const BUBBLES: readonly [number, number, number, number][] = [
  [-18, -60, 3.2, 0.7],
  [12, -110, 2.2, 0.55],
  [-4, -170, 2.8, 0.6],
  [22, -210, 1.6, 0.45],
  [-24, -250, 2, 0.5],
  [6, -300, 1.4, 0.35],
];

export const AmbientCounterArtwork = memo(function AmbientCounterArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-24 mix-blend-screen">
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 960"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="counter-flare-left" cx="6%" cy="78%" r="46%">
            <stop offset="0%" stopColor="var(--color-money)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-money)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="counter-flare-right" cx="92%" cy="22%" r="48%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.07" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="counter-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.9" />
            <stop offset="45%" stopColor="var(--color-glint)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="counter-pour" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-money)" stopOpacity="0" />
            <stop offset="35%" stopColor="var(--color-money)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-money)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="counter-liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-money)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-money)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="counter-receipt" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.08" />
            <stop offset="70%" stopColor="var(--color-glint)" stopOpacity="0.02" />
            <stop offset="100%" stopColor="var(--color-glint)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="counter-facet" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-glint)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-money)" stopOpacity="0.06" />
          </linearGradient>
          <filter id="counter-blur-soft">
            <feGaussianBlur stdDeviation="60" />
          </filter>
          <filter id="counter-blur-medium">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <g id="counter-arm">
            <path d={ARM} stroke="var(--color-money)" strokeOpacity="0.25" strokeWidth="7" strokeLinecap="round" />
            <path d={ARM} stroke="var(--color-glint)" strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round" />
            <g transform="translate(46 0)">
              <path d={hexPath(16)} fill="url(#counter-facet)" stroke="var(--color-money)" strokeOpacity="0.6" strokeWidth="1.4" />
            </g>
            <circle cx="100" cy="0" r="2.6" fill="var(--color-glint)" />
          </g>
        </defs>

        <rect width="100%" height="100%" fill="url(#counter-flare-left)" filter="url(#counter-blur-soft)" />
        <rect width="100%" height="100%" fill="url(#counter-flare-right)" filter="url(#counter-blur-soft)" />

        {/* ── Left flank: the pour ─────────────────────────────────────────── */}
        <g transform="translate(250 900)">
          {/* The tap: a spout arriving from off canvas, and its lip. */}
          <path d="M-260 -620 C-150 -620, -40 -640, 20 -640 L60 -640" stroke="url(#counter-glass)" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 -646 L60 -612" stroke="var(--color-glint)" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />

          {/* The stream, with a soft glow behind it. */}
          <path d="M60 -612 C62 -520, 52 -420, 40 -300" stroke="url(#counter-pour)" strokeWidth="9" strokeLinecap="round" filter="url(#counter-blur-medium)" opacity="0.5" />
          <path d="M60 -612 C62 -520, 52 -420, 40 -300" stroke="url(#counter-pour)" strokeWidth="2.2" strokeLinecap="round" />

          {/* The highball: two walls, a heavy base, liquid and a meniscus. */}
          <g transform="translate(40 0)">
            <path d="M-78 -330 L-66 0" stroke="url(#counter-glass)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M78 -330 L66 0" stroke="url(#counter-glass)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M-68 -250 L-66 0 L66 0 L68 -250 Z" fill="url(#counter-liquid)" />
            <ellipse cx="0" cy="-250" rx="68" ry="12" fill="var(--color-money)" fillOpacity="0.14" stroke="var(--color-money)" strokeOpacity="0.7" strokeWidth="1.2" />
            <ellipse cx="0" cy="-250" rx="50" ry="7" stroke="var(--color-glint)" strokeOpacity="0.5" strokeWidth="0.7" />
            <ellipse cx="0" cy="-330" rx="78" ry="14" stroke="var(--color-glint)" strokeOpacity="0.45" strokeWidth="1" />
            <path d="M-66 0 C-30 14, 30 14, 66 0" stroke="var(--color-glint)" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
            {BUBBLES.map(([x, y, r, o], i) => (
              <circle key={i} cx={x} cy={y} r={r} stroke="var(--color-glint)" strokeOpacity={o} strokeWidth="0.9" />
            ))}
            {/* A single specular highlight down the glass. */}
            <path d="M-52 -300 L-44 -40" stroke="var(--color-glint)" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" filter="url(#counter-blur-medium)" />
          </g>
        </g>

        {/* ── Right flank: the receipt and the crystal ─────────────────────── */}
        <g transform="translate(1330 -40) rotate(14)">
          <path
            d="M0 0 L180 0 L180 420 C180 520, 120 560, 60 600 C20 626, -10 660, -20 700 L-20 280 Z"
            fill="url(#counter-receipt)"
            stroke="var(--color-glint)"
            strokeOpacity="0.28"
            strokeWidth="1"
          />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M24 ${60 + i * 40} L${i % 3 === 2 ? 110 : 150} ${60 + i * 40}`} stroke="var(--color-glint)" strokeOpacity={0.3 - i * 0.025} strokeWidth="1" strokeLinecap="round" />
          ))}
          {/* The zigzag tear at the head of the roll. */}
          <path d="M0 0 L15 12 L30 0 L45 12 L60 0 L75 12 L90 0 L105 12 L120 0 L135 12 L150 0 L165 12 L180 0" stroke="var(--color-glint)" strokeOpacity="0.4" strokeWidth="1" />
        </g>

        <g transform="translate(1180 720) rotate(18) scale(1.15)" opacity="0.7">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <use key={a} href="#counter-arm" transform={`rotate(${a})`} />
          ))}
          <path d={hexPath(22)} fill="url(#counter-facet)" stroke="var(--color-money)" strokeOpacity="0.7" strokeWidth="1.6" />
          <circle r="2" fill="var(--color-glint)" />
        </g>
      </svg>
    </div>
  );
});
