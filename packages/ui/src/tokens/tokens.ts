/**
 * Bliss design tokens. The only source of colour, type, space, radius, elevation and motion.
 * docs/06-design-system.md section 9 and docs/07-motion-and-interaction.md.
 *
 * A raw hex anywhere else is a lint failure. `pnpm tokens:build` turns this file into the
 * Tailwind theme and the semantic CSS variables in ../styles/tokens.css, and `pnpm tokens:check`
 * fails CI when the two drift apart.
 */

export const colour = {
  frost: {
    0: '#FBFCFD',
    50: '#F4F7F9',
    100: '#E7ECF0',
    200: '#D4DCE3',
    300: '#B3BFC9',
    400: '#8C9AA6',
    500: '#6B7884',
    600: '#4E5A65',
    700: '#38424B',
    800: '#232B32',
    900: '#151B20',
    950: '#0B1015',
  },
  glacier: {
    200: '#A8DCE6',
    300: '#6FC6D6',
    400: '#3FAAC0',
    500: '#2A8CA3',
    600: '#1F6E82',
    700: '#17545F',
  },
  ember: {
    300: '#E9BE86',
    400: '#E0A35A',
    600: '#97591A',
  },
  signal: {
    poured: { light: '#2E7D52', dark: '#63B98A' },
    low: { light: '#97591A', dark: '#E0A35A' },
    stop: { light: '#A33232', dark: '#E08585' },
    info: { light: '#1F6E82', dark: '#6FC6D6' },
  },
  /** Fixed, eight entries, by (seat_no - 1) mod 8. Identical on both themes. */
  seat: ['#6FC6D6', '#E0A35A', '#9DC271', '#B79BE0', '#E58BA4', '#7FA8E0', '#D9C46B', '#6FD2B4'],
  seatText: '#0B1015',
  scrim: 'rgba(11, 16, 21, 0.55)',
  lightShadow: 'rgba(11, 16, 21, 0.05)',
  /** Depth under the atmosphere layer's glass. Black, not frost-950, so it reads on any photograph. */
  deepShadow: 'rgba(0, 0, 0, 0.5)',
  keyShadow: 'rgba(0, 0, 0, 0.2)',
  softShadow: 'rgba(11, 16, 21, 0.12)',
} as const;

/** A theme colour at a given opacity, resolved by the browser so the token stays one hex. */
const alpha = (hex: string, percent: number) => `color-mix(in oklab, ${hex} ${percent}%, transparent)`;

export const seatNames = ['Glacier', 'Ember', 'Leaf', 'Iris', 'Rose', 'Steel', 'Brass', 'Jade'] as const;

/** Category colour tokens map onto the seat palette hues so a category edge never needs a hex. */
export const categoryColour = {
  glacier: colour.seat[0],
  ember: colour.seat[1],
  leaf: colour.seat[2],
  iris: colour.seat[3],
  rose: colour.seat[4],
  steel: colour.seat[5],
  brass: colour.seat[6],
  jade: colour.seat[7],
} as const;

const f = colour.frost;
const g = colour.glacier;
const e = colour.ember;
const s = colour.signal;

/**
 * Semantic roles per theme. Components only ever use these names, so both themes are first class
 * and neither is a filter over the other.
 */
export const themes = {
  dark: {
    page: f[950],
    raised: f[800],
    sunken: f[900],
    overlay: f[800],
    hairline: f[700],
    rule: f[800],
    'rule-raised': f[700],
    ink: f[50],
    'ink-muted': f[300],
    'ink-subtle': f[400],
    'ink-disabled': f[600],
    'control': f[800],
    'control-hover': f[700],
    'control-pressed': f[600],
    accent: g[300],
    'accent-hover': g[400],
    'accent-pressed': g[500],
    'accent-ink': f[950],
    'accent-text': g[300],
    'accent-subtle': g[700],
    attention: e[400],
    'attention-subtle': e[300],
    money: e[300],
    poured: s.poured.dark,
    low: s.low.dark,
    stop: s.stop.dark,
    'stop-ink': f[950],
    info: s.info.dark,
    focus: g[400],
    'seat-ring': f[0],
    shared: f[300],
    skeleton: f[800],
    chart: g[300],
    'chart-muted': g[600],
    grid: f[800],
    /* Atmosphere layer, docs/12-surface-language.md: translucent panes over artwork and photography. */
    glass: alpha(f[800], 40),
    'glass-hover': alpha(f[800], 65),
    'glass-strong': alpha(f[800], 65),
    'glass-strong-hover': alpha(f[800], 80),
    'glass-edge': alpha(f[700], 30),
    'glass-edge-hover': alpha(f[700], 70),
    veil: alpha(f[50], 3),
    'veil-hover': alpha(f[50], 8),
    'veil-edge': alpha(f[700], 20),
    'veil-edge-hover': alpha(f[700], 40),
    glint: f[0],
    /* Working surfaces, docs/13-floor-tabs-revamp.md: a tint on the row it marks, never a nested box. */
    'accent-wash': alpha(g[300], 10),
    'stop-wash': alpha(s.stop.dark, 10),
  },
  light: {
    page: f[0],
    raised: f[50],
    sunken: f[100],
    overlay: f[50],
    hairline: f[200],
    rule: f[100],
    'rule-raised': f[200],
    ink: f[900],
    'ink-muted': f[700],
    'ink-subtle': f[600],
    'ink-disabled': f[300],
    'control': f[100],
    'control-hover': f[200],
    'control-pressed': f[300],
    accent: g[600],
    'accent-hover': g[500],
    'accent-pressed': g[700],
    'accent-ink': f[0],
    'accent-text': g[600],
    'accent-subtle': g[200],
    attention: e[600],
    'attention-subtle': e[600],
    money: f[900],
    poured: s.poured.light,
    low: s.low.light,
    stop: s.stop.light,
    'stop-ink': f[0],
    info: s.info.light,
    // glacier-400 measures 2.6:1 on frost-0, below the 3:1 floor for a focus indicator. D-07.
    focus: g[600],
    'seat-ring': f[950],
    // frost-300 measures 1.8:1 on frost-0, so the dashed Shared outline uses frost-600. D-08.
    shared: f[600],
    skeleton: f[100],
    chart: g[600],
    'chart-muted': g[200],
    grid: f[200],
    glass: alpha(f[0], 72),
    'glass-hover': alpha(f[0], 90),
    'glass-strong': alpha(f[0], 85),
    'glass-strong-hover': alpha(f[0], 95),
    'glass-edge': alpha(f[200], 70),
    'glass-edge-hover': f[200],
    veil: alpha(f[900], 3),
    'veil-hover': alpha(f[900], 7),
    'veil-edge': alpha(f[200], 60),
    'veil-edge-hover': f[200],
    glint: f[0],
    'accent-wash': alpha(g[600], 8),
    'stop-wash': alpha(s.stop.light, 8),
  },
} as const;

export type ThemeName = keyof typeof themes;
export type SemanticColour = keyof (typeof themes)['dark'];

/**
 * Type scale, docs/06-design-system.md section 3. [size, line height, tracking, weight].
 * Weights never exceed 500. There is no third entry, deliberately.
 */
export const weight = { regular: 400, medium: 500 } as const;

export const type = {
  display: { size: 40, lineHeight: 44, tracking: '-0.025em', weight: 400 },
  'title-lg': { size: 28, lineHeight: 34, tracking: '-0.02em', weight: 400 },
  title: { size: 20, lineHeight: 26, tracking: '-0.015em', weight: 400 },
  subtitle: { size: 16, lineHeight: 22, tracking: '-0.01em', weight: 400 },
  'body-lg': { size: 17, lineHeight: 24, tracking: '-0.005em', weight: 400 },
  body: { size: 15, lineHeight: 22, tracking: '0em', weight: 400 },
  'body-sm': { size: 13, lineHeight: 19, tracking: '0em', weight: 400 },
  label: { size: 12, lineHeight: 15, tracking: '0.02em', weight: 500 },
  micro: { size: 10, lineHeight: 13, tracking: '0.08em', weight: 500 },
  /* Atmosphere layer. Set in JetBrains Mono and rendered in capitals by the eyebrow and caps
   * utilities; the source string stays sentence case, so screen readers read words, not letters. */
  eyebrow: { size: 11, lineHeight: 14, tracking: '0.2em', weight: 500 },
  caps: { size: 11, lineHeight: 14, tracking: '0.08em', weight: 500 },
  badge: { size: 10, lineHeight: 12, tracking: '0.06em', weight: 500 },
  heading: { size: 32, lineHeight: 36, tracking: '-0.02em', weight: 500 },
  persona: { size: 42, lineHeight: 42, tracking: '-0.02em', weight: 500 },
  clock: { size: 112, lineHeight: 96, tracking: '-0.04em', weight: 400 },
  'num-xl': { size: 40, lineHeight: 44, tracking: '-0.04em', weight: 400 },
  'num-lg': { size: 24, lineHeight: 30, tracking: '-0.02em', weight: 400 },
  num: { size: 15, lineHeight: 22, tracking: '-0.01em', weight: 400 },
  'num-sm': { size: 12, lineHeight: 17, tracking: '0em', weight: 400 },
} as const;

export type TypeToken = keyof typeof type;

export const fontFamily = {
  sans: "var(--font-geist-sans), 'Geist', ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 4px base. Nothing in between. */
export const space = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96] as const;

/** Three values. No pills, no circles except the connection dot and status dots. */
export const radius = { sm: 6, md: 10, lg: 16, dot: 9999 } as const;

/**
 * Component dimensions. Not space: these size things, they do not separate them.
 * Touch targets are 48 on Floor and 44 on Counter, with 8px between adjacent targets.
 */
export const size = {
  'chip-dense': 22,
  'chip-tile': 16,
  chip: 40,
  'chip-picker': 56,
  'control-sm': 32,
  'control-md': 40,
  'control-lg': 48,
  'control-xl': 56,
  'target-floor': 48,
  'target-counter': 44,
  'row': 44,
  'row-compact': 36,
  'row-floor': 48,
  keypad: 72,
  'tile-min': 96,
  tile: 116,
  'rail-nav': 72,
  'rail-tables': 180,
  'rail-ticket': 340,
  'rail-console': 220,
  'panel-tender': 420,
  strip: 56,
  base: 72,
  'base-console': 40,
  dot: 6,
  avatar: 64,
  'avatar-lg': 96,
  node: 32,
  /** The Floor tab card and free table card: a minimum, so a long name or large text never clips. */
  'card-tab': 148,
  /** A count badge on a nav item or a zone chip. */
  count: 18,
  /** A Floor nav rail item and a tables rail tab row. */
  'nav-item': 64,
} as const;

/** One level of elevation. There is no level two, deliberately. */
export const elevation = {
  dark: 'none',
  light: `0 1px 2px ${colour.lightShadow}`,
} as const;

/**
 * The atmosphere layer's depth, docs/12-surface-language.md. Not a second elevation level: a glass
 * pane is the one raised surface on an atmospheric screen, and it needs a real shadow to separate
 * from artwork where a flat Console pane needs none. `key` sits under keypad keys only.
 */
export const atmosphere = {
  lift: { dark: `0 12px 32px -8px ${colour.deepShadow}`, light: `0 12px 32px -12px ${colour.softShadow}` },
  key: { dark: `0 4px 16px ${colour.keyShadow}`, light: `0 2px 8px ${colour.softShadow}` },
  blur: { glass: 8, veil: 12 },
  /** Hover and border transitions on glass. Press feedback never waits for these. */
  surfaceMs: 300,
  glideMs: 500,
  pressScale: 0.985,
  keyScale: 0.94,
} as const;

export const motion = {
  ease: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    in: 'cubic-bezier(0.64, 0, 0.78, 0)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    snap: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  },
  ceilingMs: { floor: 140, bar: 160, counter: 240, console: 400 },
  hoverMs: 160,
  pressMs: 100,
  longPressMs: 450,
  feedbackMs: 100,
} as const;

export const breakpoints = { tablet: 960, desktop: 1280, wide: 1440 } as const;

/**
 * Every text on surface pair used in the product, with its use and the measured WCAG ratio.
 * packages/ui/src/tokens/contrast.test.ts recomputes each ratio, fails below the floor for its
 * use (4.5 body, 3 large text and UI boundaries) and fails if a comment here drifts from reality.
 */
export type ContrastUse = 'body' | 'large' | 'ui';

export interface ContrastPair {
  name: string;
  fg: string;
  bg: string;
  use: ContrastUse;
  measured: number;
}

export const contrastPairs: ContrastPair[] = [
  // Dark: Floor, Counter, Bar, Console dark
  { name: 'dark ink on page', fg: f[50], bg: f[950], use: 'body', measured: 17.76 }, // 17.76:1
  { name: 'dark ink on raised', fg: f[50], bg: f[800], use: 'body', measured: 13.34 }, // 13.34:1
  { name: 'dark ink-muted on page', fg: f[300], bg: f[950], use: 'body', measured: 10.2 }, // 10.20:1
  { name: 'dark ink-muted on raised', fg: f[300], bg: f[800], use: 'body', measured: 7.66 }, // 7.66:1
  { name: 'dark ink-subtle on page', fg: f[400], bg: f[950], use: 'body', measured: 6.63 }, // 6.63:1
  { name: 'dark ink-subtle on raised', fg: f[400], bg: f[800], use: 'body', measured: 4.98 }, // 4.98:1
  { name: 'dark ink-subtle on sunken', fg: f[400], bg: f[900], use: 'body', measured: 6.03 }, // 6.03:1
  { name: 'dark accent text on page', fg: g[300], bg: f[950], use: 'body', measured: 9.76 }, // 9.76:1
  { name: 'dark accent ink on accent', fg: f[950], bg: g[300], use: 'body', measured: 9.76 }, // 9.76:1
  { name: 'dark accent ink on accent hover', fg: f[950], bg: g[400], use: 'body', measured: 7.03 }, // 7.03:1
  { name: 'dark money on page', fg: e[300], bg: f[950], use: 'body', measured: 11.08 }, // 11.08:1
  { name: 'dark attention on page', fg: e[400], bg: f[950], use: 'body', measured: 8.69 }, // 8.69:1
  { name: 'dark attention on raised', fg: e[400], bg: f[800], use: 'body', measured: 6.53 }, // 6.53:1
  { name: 'dark poured on page', fg: s.poured.dark, bg: f[950], use: 'body', measured: 8.04 }, // 8.04:1
  { name: 'dark stop on page', fg: s.stop.dark, bg: f[950], use: 'body', measured: 7.15 }, // 7.15:1
  { name: 'dark stop on raised', fg: s.stop.dark, bg: f[800], use: 'body', measured: 5.37 }, // 5.37:1
  { name: 'dark stop ink on stop', fg: f[950], bg: s.stop.dark, use: 'body', measured: 7.15 }, // 7.15:1
  { name: 'dark info on page', fg: s.info.dark, bg: f[950], use: 'body', measured: 9.76 }, // 9.76:1
  { name: 'dark info on sunken', fg: s.info.dark, bg: f[900], use: 'body', measured: 8.87 }, // 8.87:1
  { name: 'dark disabled on page', fg: f[600], bg: f[950], use: 'ui', measured: 2.71 }, // 2.71:1, disabled is exempt from 1.4.3; kept above 2.5 for legibility
  { name: 'dark focus ring on page', fg: g[400], bg: f[950], use: 'ui', measured: 7.03 }, // 7.03:1
  { name: 'dark hairline on page', fg: f[700], bg: f[950], use: 'ui', measured: 1.86 }, // 1.86:1, decorative grouping rule, not a control boundary
  { name: 'dark shared outline on page', fg: f[300], bg: f[950], use: 'ui', measured: 10.2 }, // 10.20:1
  { name: 'dark seat ring on page', fg: f[0], bg: f[950], use: 'ui', measured: 18.6 }, // 18.60:1

  // Light: Console default
  { name: 'light ink on page', fg: f[900], bg: f[0], use: 'body', measured: 16.9 }, // 16.90:1
  { name: 'light ink on raised', fg: f[900], bg: f[50], use: 'body', measured: 16.14 }, // 16.14:1
  { name: 'light ink-muted on page', fg: f[700], bg: f[0], use: 'body', measured: 9.98 }, // 9.98:1
  { name: 'light ink-subtle on page', fg: f[600], bg: f[0], use: 'body', measured: 6.87 }, // 6.87:1
  { name: 'light ink-subtle on raised', fg: f[600], bg: f[50], use: 'body', measured: 6.56 }, // 6.56:1
  { name: 'light ink-subtle on sunken', fg: f[600], bg: f[100], use: 'body', measured: 5.94 }, // 5.94:1
  { name: 'light accent text on page', fg: g[600], bg: f[0], use: 'body', measured: 5.66 }, // 5.66:1
  { name: 'light accent ink on accent', fg: f[0], bg: g[600], use: 'body', measured: 5.66 }, // 5.66:1
  { name: 'light accent ink on accent pressed', fg: f[0], bg: g[700], use: 'body', measured: 8.28 }, // 8.28:1
  { name: 'light attention on page', fg: e[600], bg: f[0], use: 'body', measured: 5.44 }, // 5.44:1
  { name: 'light attention on raised', fg: e[600], bg: f[50], use: 'body', measured: 5.19 }, // 5.19:1
  { name: 'light poured on page', fg: s.poured.light, bg: f[0], use: 'body', measured: 4.9 }, // 4.90:1
  { name: 'light stop on page', fg: s.stop.light, bg: f[0], use: 'body', measured: 6.68 }, // 6.68:1
  { name: 'light stop ink on stop', fg: f[0], bg: s.stop.light, use: 'body', measured: 6.68 }, // 6.68:1
  { name: 'light info on page', fg: s.info.light, bg: f[0], use: 'body', measured: 5.66 }, // 5.66:1
  { name: 'light focus ring on page', fg: g[600], bg: f[0], use: 'ui', measured: 5.66 }, // 5.66:1
  { name: 'light shared outline on page', fg: f[600], bg: f[0], use: 'ui', measured: 6.87 }, // 6.87:1
  { name: 'light seat ring on page', fg: f[950], bg: f[0], use: 'ui', measured: 18.6 }, // 18.60:1

  // Seat chips carry frost-950 numbers on every palette colour, on both themes.
  { name: 'seat 1 glacier', fg: colour.seatText, bg: colour.seat[0], use: 'body', measured: 9.76 }, // 9.76:1
  { name: 'seat 2 ember', fg: colour.seatText, bg: colour.seat[1], use: 'body', measured: 8.69 }, // 8.69:1
  { name: 'seat 3 leaf', fg: colour.seatText, bg: colour.seat[2], use: 'body', measured: 9.45 }, // 9.45:1
  { name: 'seat 4 iris', fg: colour.seatText, bg: colour.seat[3], use: 'body', measured: 7.99 }, // 7.99:1
  { name: 'seat 5 rose', fg: colour.seatText, bg: colour.seat[4], use: 'body', measured: 7.79 }, // 7.79:1
  { name: 'seat 6 steel', fg: colour.seatText, bg: colour.seat[5], use: 'body', measured: 7.81 }, // 7.81:1
  { name: 'seat 7 brass', fg: colour.seatText, bg: colour.seat[6], use: 'body', measured: 10.97 }, // 10.97:1
  { name: 'seat 8 jade', fg: colour.seatText, bg: colour.seat[7], use: 'body', measured: 10.51 }, // 10.51:1
];

export const tokens = {
  colour,
  themes,
  type,
  weight,
  fontFamily,
  space,
  radius,
  size,
  elevation,
  atmosphere,
  motion,
  breakpoints,
} as const;
