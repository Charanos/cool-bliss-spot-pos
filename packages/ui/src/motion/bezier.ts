/**
 * Cubic bezier easing as a function GSAP accepts. GSAP does not parse CSS `cubic-bezier()` strings,
 * so the four named curves from the token file are solved here, exactly, with no plugin.
 * Newton-Raphson with a bisection fallback, the same approach browsers use.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) return t;
      if (x > value) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
      if (hi - lo < 1e-7) break;
    }
    return t;
  }

  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return sampleY(solveX(progress));
  };
}

/** Parse "cubic-bezier(a, b, c, d)" from the token file. */
export function bezierFromCss(css: string): (t: number) => number {
  const match = css.match(/cubic-bezier\(([^)]+)\)/);
  const values = match?.[1]?.split(',').map((v) => Number(v.trim()));
  if (!values || values.length !== 4 || values.some((v) => Number.isNaN(v))) {
    throw new TypeError(`"${css}" is not a cubic-bezier`);
  }
  const [a, b, c, d] = values as [number, number, number, number];
  return cubicBezier(a, b, c, d);
}
