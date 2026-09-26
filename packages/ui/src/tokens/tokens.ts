/**
 * Bliss design tokens. The only source of colour, type, space, radius, elevation and motion.
 * docs/06-design-system.md section 9 and docs/07-motion-and-interaction.md.
 *
 * A raw hex anywhere else is a lint failure. `pnpm tokens:build` turns this file into the
 * Tailwind theme and the semantic CSS variables in ../styles/tokens.css, and `pnpm tokens:check`
 * fails CI when the two drift apart.
 */

export const colour = {
  /** Printed output: thermal paper and its one ink. Never used on a screen surface. */
  paper: { white: '#FFFFFF', ink: '#000000' },
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
    /** The dark Console sheet: lifted one half step off the page so it floats on the desk. */
    925: '#0F151A',
    /** The dark desk under the Console sheet: the one step below the page. */
    975: '#06090C',
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
    served: { light: '#235896', dark: '#7FA8E0' },
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
    served: s.served.dark,
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
    /* Print, docs/08 section 7: the page is paper and the ink is black, in either theme. */
    paper: colour.paper.white,
    'paper-ink': colour.paper.ink,
    'paper-desk': f[100],
    /* Working surfaces, docs/13-floor-tabs-revamp.md: a tint on the row it marks, never a nested box. */
    'accent-wash': alpha(g[300], 10),
    'stop-wash': alpha(s.stop.dark, 10),
    'poured-wash': alpha(s.poured.dark, 10),
    'served-wash': alpha(s.served.dark, 10),
    'attention-wash': alpha(e[400], 12),
    'low-wash': alpha(s.low.dark, 12),
    'info-wash': alpha(s.info.dark, 10),
    'neutral-wash': alpha(f[700], 45),
    /* Console, docs/19-console-system.md. The Card family: one surface a step off the page, its edge,
     * and the bands that head and foot it. The rail sits one tonal step off the page. */
    card: f[900],
    edge: alpha(f[700], 75),
    'edge-strong': f[700],
    band: alpha(f[800], 45),
    'band-strong': alpha(f[800], 75),
    rail: f[900],
    'rail-hover': alpha(f[800], 70),
    'rail-active': f[800],
    /* The Console desk, docs/19 section 4: the sunken ground the navigation sits on, under the one
     * floating sheet that holds the page. The active item is a chip of the sheet's own surface. */
    desk: f[975],
    /* The sheet the page sits on. Inside it, `page` becomes this. */
    sheet: f[925],
    'desk-hover': alpha(f[800], 55),
    'desk-active': f[900],
    'desk-well': alpha(f[900], 70),
    'on-scrim': f[0],
    /* The selected segment of a segmented control: a thumb, not a nested pane. */
    thumb: f[700],
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
    // A border or glow in the attention hue, never text: text in attention uses `attention` itself.
    'attention-subtle': e[300],
    money: f[900],
    poured: s.poured.light,
    served: s.served.light,
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
    /* Print, docs/08 section 7: the page is paper and the ink is black, in either theme. */
    paper: colour.paper.white,
    'paper-ink': colour.paper.ink,
    'paper-desk': f[100],
    'accent-wash': alpha(g[600], 8),
    'stop-wash': alpha(s.stop.light, 8),
    'poured-wash': alpha(s.poured.light, 8),
    'served-wash': alpha(s.served.light, 8),
    'attention-wash': alpha(e[600], 9),
    'low-wash': alpha(s.low.light, 9),
    'info-wash': alpha(s.info.light, 8),
    'neutral-wash': alpha(f[200], 55),
    card: f[0],
    edge: alpha(f[200], 80),
    'edge-strong': f[200],
    band: alpha(f[100], 45),
    'band-strong': alpha(f[100], 80),
    rail: f[50],
    'rail-hover': alpha(f[200], 45),
    'rail-active': alpha(f[200], 70),
    desk: f[100],
    sheet: f[0],
    'desk-hover': alpha(f[200], 70),
    'desk-active': f[0],
    'desk-well': alpha(f[0], 55),
    'on-scrim': f[0],
    thumb: f[0],
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
  /*
   * The Console ramp, docs/19-console-system.md section 2. A dense desktop tool reads at 14px, and a
   * page has exactly three heading levels: the page, a section, and a card. Floor and Counter keep
   * the scale above; nothing here changes them.
   */
  'title-page': { size: 26, lineHeight: 32, tracking: '-0.022em', weight: 500 },
  'title-section': { size: 17, lineHeight: 24, tracking: '-0.012em', weight: 500 },
  'title-card': { size: 15, lineHeight: 20, tracking: '-0.006em', weight: 500 },
  ui: { size: 14, lineHeight: 20, tracking: '0em', weight: 400 },
  /* Capitals over a value in a card, and rail group names. Never a sentence. */
  overline: { size: 11, lineHeight: 14, tracking: '0.06em', weight: 500 },
  'num-kpi': { size: 30, lineHeight: 36, tracking: '-0.03em', weight: 500 },
  'num-md': { size: 14, lineHeight: 20, tracking: '-0.01em', weight: 400 },
} as const;

export type TypeToken = keyof typeof type;

export const fontFamily = {
  sans: "var(--font-geist-sans), 'Geist', ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace",
} as const;

/** 4px base. Nothing in between. */
export const space = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96] as const;

/**
 * Chips `sm`, rows, tiles and small buttons `md`, buttons `control`, sheets `lg`. The Console adds `card` (the Card family, the same
 * value as `lg`), `overlay` for dialogs, and `pill`, which only a count badge or a segmented control
 * uses. Status chips stay `sm`.
 */
export const radius = { sm: 6, md: 10, control: 12, sheet: 14, lg: 16, card: 16, overlay: 20, pill: 9999, dot: 9999 } as const;

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
  'rail-console': 240,
  'rail-collapsed': 64,
  /** The Console desk navigation, open and folded, and the gap the sheet floats in. */
  'desk-nav': 232,
  'desk-nav-collapsed': 60,
  'sheet-inset': 8,
  /** The Console top bar and the rail's venue block, aligned. */
  bar: 56,
  /** The Console content column. */
  'page-max': 1440,
  /** Below this the Console scrolls sideways rather than crushing its columns. */
  'frame-min': 1024,
  /** A nav item in the Console rail. */
  'rail-item': 32,
  /** A toolbar search field, and a popover list's width and height limits. */
  search: 240,
  'popover-min': 200,
  popover: 320,
  /** A photo shown at full size inside a dialog. */
  lightbox: 720,
  /** A KPI card's figure row, so a row of metrics shares one baseline. */
  'kpi-min': 136,
  /** The totals block at the foot of a bill, an order or a delivery. */
  totals: 320,
  /** A single-column Console form: a count, a zone, a person. */
  form: 720,
  'panel-tender': 420,
  strip: 56,
  /** The top bar on a phone, and on any screen shorter than the `short` variant's ceiling. */
  'strip-compact': 48,
  base: 72,
  /** The base layer on a phone: one action and the person's name, nothing else. */
  'base-compact': 60,
  'base-console': 40,
  /** A dock item: the whole tap target, icon over label. */
  'dock-item': 52,
  'dock-item-lg': 56,
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

/**
 * The Console's Card family, docs/19-console-system.md section 1. A card is one surface on the page;
 * its shadow says so in light, and in dark (where shadows vanish) its edge does. Hover deepens the
 * shadow a step; it never adds a second level. `popover` is for menus and the command menu.
 */
const ink = (percent: number) => alpha(f[950], percent);
export const consoleElevation = {
  card: { light: `0 1px 2px ${ink(4)}, 0 2px 8px ${ink(3)}`, dark: 'none' },
  'card-hover': { light: `0 1px 2px ${ink(5)}, 0 10px 28px -6px ${ink(10)}`, dark: `0 12px 28px -12px ${alpha('#000000', 60)}` },
  /* Buttons, on every surface: a lit top edge, and for the primary a glow in its own colour. */
  control: { light: `inset 0 1px 0 color-mix(in oklab, var(--bliss-ink) 8%, transparent)`, dark: `inset 0 1px 0 color-mix(in oklab, var(--bliss-ink) 8%, transparent)` },
  'control-primary': {
    light: `inset 0 1px 0 color-mix(in oklab, var(--bliss-ink) 22%, transparent), 0 6px 18px -8px color-mix(in oklab, var(--bliss-accent) 55%, transparent)`,
    dark: `inset 0 1px 0 color-mix(in oklab, var(--bliss-ink) 22%, transparent), 0 6px 18px -8px color-mix(in oklab, var(--bliss-accent) 55%, transparent)`,
  },
  /* The floating sheet: a hairline, a contact shadow and a long soft fall onto the desk. */
  sheet: {
    light: `0 0 0 1px ${ink(6)}, 0 1px 2px ${ink(4)}, 0 12px 32px -16px ${ink(16)}`,
    dark: `0 0 0 1px ${f[800]}, 0 16px 40px -20px ${alpha('#000000', 80)}`,
  },
  /* The active desk item: a chip of the sheet's surface, raised by a hair. */
  chip: { light: `0 0 0 1px ${ink(6)}, 0 1px 2px ${ink(6)}`, dark: `0 0 0 1px ${f[800]}` },
  /* A well sunk into the desk: the search field and the tonight card. */
  well: { light: `inset 0 0 0 1px ${ink(6)}, inset 0 1px 2px ${ink(4)}`, dark: `inset 0 0 0 1px ${f[800]}` },
  popover: { light: `0 12px 32px -8px ${ink(18)}, 0 2px 6px ${ink(6)}`, dark: `0 16px 40px -8px ${alpha('#000000', 70)}, 0 0 0 1px ${f[700]}` },
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
  /** A card lifting under the pointer, and the rail folding. */
  cardMs: 240,
  pressMs: 100,
  longPressMs: 450,
  feedbackMs: 100,
} as const;

/**
 * Mobile first, in the devices this actually runs on. docs/16-responsive-and-offline.md.
 *
 *   base      a phone held upright, 360 to 430 wide
 *   compact   a phone on its side, and the small tablets the outlet keeps as spares
 *   pad       a tablet upright, 768: the Floor's own device in portrait
 *   tablet    a tablet on its side, the Floor and Counter at 10 inches
 *   desktop   the Console, and a counter on a monitor
 *   wide      a large monitor in the office
 *
 * Height matters as much as width on a phone on its side, where 360px of height has to hold a
 * header, a list and a dock: the `short` variant in base.css answers that.
 */
export const breakpoints = { compact: 480, pad: 768, tablet: 960, desktop: 1280, wide: 1440 } as const;

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

  // Console rail and cards, docs/19. The active rail item tints the rail in light; its text is on rail.
  { name: 'light ink on rail', fg: f[900], bg: f[50], use: 'body', measured: 16.14 }, // 16.14:1
  { name: 'light ink-muted on rail', fg: f[700], bg: f[50], use: 'body', measured: 9.53 }, // 9.53:1
  { name: 'light ink-subtle on rail', fg: f[600], bg: f[50], use: 'body', measured: 6.56 }, // 6.56:1
  { name: 'light accent text on rail', fg: g[600], bg: f[50], use: 'body', measured: 5.41 }, // 5.41:1
  { name: 'dark ink-muted on rail and card', fg: f[300], bg: f[900], use: 'body', measured: 9.27 }, // 9.27:1
  { name: 'dark ink-subtle on rail and card', fg: f[400], bg: f[900], use: 'body', measured: 6.03 }, // 6.03:1
  { name: 'dark ink on rail active', fg: f[50], bg: f[800], use: 'body', measured: 13.34 }, // 13.34:1
  { name: 'dark accent text on rail active', fg: g[300], bg: f[800], use: 'body', measured: 7.33 }, // 7.33:1

  // The Console desk and its active chip, docs/19 section 4.
  { name: 'light ink on desk', fg: f[900], bg: f[100], use: 'body', measured: 14.6 }, // 14.60:1
  { name: 'light ink-muted on desk', fg: f[700], bg: f[100], use: 'body', measured: 8.62 }, // 8.62:1
  { name: 'light ink-subtle on desk', fg: f[600], bg: f[100], use: 'body', measured: 5.94 }, // 5.94:1
  { name: 'light accent text on desk', fg: g[600], bg: f[100], use: 'body', measured: 4.89 }, // 4.89:1
  { name: 'dark ink on desk', fg: f[50], bg: f[975], use: 'body', measured: 18.55 }, // 18.55:1
  { name: 'dark ink-muted on desk', fg: f[300], bg: f[975], use: 'body', measured: 10.66 }, // 10.66:1
  { name: 'dark ink on sheet', fg: f[50], bg: f[925], use: 'body', measured: 17.08 }, // 17.08:1
  { name: 'dark ink-muted on sheet', fg: f[300], bg: f[925], use: 'body', measured: 9.81 }, // 9.81:1
  { name: 'dark ink-subtle on sheet', fg: f[400], bg: f[925], use: 'body', measured: 6.38 }, // 6.38:1
  { name: 'dark accent text on sheet', fg: g[300], bg: f[925], use: 'body', measured: 9.39 }, // 9.39:1
  { name: 'dark ink-subtle on desk', fg: f[400], bg: f[975], use: 'body', measured: 6.93 }, // 6.93:1

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
  consoleElevation,
  atmosphere,
  motion,
  breakpoints,
} as const;
