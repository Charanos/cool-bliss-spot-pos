/** WCAG 2.1 relative luminance and contrast ratio. */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const CONTRAST_FLOOR = { body: 4.5, large: 3, ui: 3 } as const;

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function linear(value: number): number {
  return channel(value);
}

function encode(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
}

/**
 * A colour as a weak laptop panel shows it: blacks lifted to 4% of white, a flat 1.8 gamma where 2.2
 * was intended (mid tones brighter, so steps between dark surfaces shrink), and 70% of the saturation.
 * A rough model of a budget TN screen, used only to test that Clarity survives one. docs/11 D-25.
 */
export function weakPanel(hex: string): string {
  const clean = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => linear(Number.parseInt(clean.slice(i, i + 2), 16)));
  const flattened = rgb.map((v) => 0.04 + 0.96 * v ** (1.8 / 2.2));
  const y = 0.2126 * flattened[0]! + 0.7152 * flattened[1]! + 0.0722 * flattened[2]!;
  const washed = flattened.map((v) => y + 0.7 * (v - y));
  return toHex(washed.map(encode) as [number, number, number]);
}

/** How far apart two colours sit, as a plain distance in sRGB, 0 to about 441. */
export function separation(a: string, b: string): number {
  const parse = (hex: string) => [0, 2, 4].map((i) => Number.parseInt(hex.replace('#', '').slice(i, i + 2), 16));
  const [x, y] = [parse(a), parse(b)];
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
}
