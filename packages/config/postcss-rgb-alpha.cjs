/* global module */
/**
 * Translucent colour every supported browser can read. docs/11 D-24.
 *
 * Tailwind v4 writes a tint such as `bg-accent/10` as `color-mix(in oklab, var(--color-accent) 10%,
 * transparent)` inside `@supports (color: color-mix(...))`, with a fallback of the full colour. Safari
 * 15, on the Floor's iPad mini 4, has no color-mix(), so every soft wash, ring and border there became
 * solid. The tokens publish each solid colour's channels (`--bliss-accent-rgb: 111 198 214`), so the
 * same tint is `rgb(var(--bliss-accent-rgb) / 10%)`, which Safari has read since 12.1.
 *
 * This plugin runs after Tailwind and rewrites every color-mix() it can:
 *  - a colour and `transparent`: exactly `rgb(<channels> / p%)`;
 *  - two colours: the lesser, by weight, laid over what is beneath at its weight. The greater is always a
 *    neutral surface or edge, so the tint over that surface is what shows.
 * A guard left with nothing to guard is unwrapped, so the rewritten rules keep their place in the cascade.
 * Anything it cannot rewrite is left exactly as it was, still inside its guard.
 */

/** Split a function's arguments at top-level commas. */
function splitArgs(inner) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts;
}

/** "var(--color-accent) 25%" as { colour: 'var(--color-accent)', percent: 25 }. */
function colourStop(part) {
  const m = /^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/.exec(part.trim());
  return m ? { colour: m[1].trim(), percent: m[2] === undefined ? null : Number(m[2]) } : null;
}

function hexChannels(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)).join(' ');
}

const rgbAlpha = () => {
  return {
    postcssPlugin: 'bliss-rgb-alpha',
    OnceExit(root) {
      // Every channel variable the stylesheet declares, so a colour is only rewritten when its channels exist.
      const channels = new Set();
      root.walkDecls(/-rgb$/, (decl) => {
        if (decl.prop.startsWith('--')) channels.add(decl.prop);
      });

      /** The channels of a colour: a token, its Tailwind alias, a hex, white or black. Null when unknown. */
      const channelsOf = (colour) => {
        const token = /^var\((--[\w-]+)\)$/.exec(colour)?.[1];
        if (token) {
          const direct = `${token}-rgb`;
          if (channels.has(direct)) return `var(${direct})`;
          const alias = token.startsWith('--color-') ? `--bliss-${token.slice('--color-'.length)}-rgb` : null;
          if (alias && channels.has(alias)) return `var(${alias})`;
          return null;
        }
        if (colour.startsWith('#')) return hexChannels(colour);
        if (colour === 'white') return '255 255 255';
        if (colour === 'black') return '0 0 0';
        return null;
      };

      /** One color-mix() call as rgb(), or null when it cannot be expressed that way. */
      const rewrite = (inner) => {
        const [space, a, b] = splitArgs(inner);
        if (!space?.startsWith('in ') || !a || !b) return null;
        const first = colourStop(a);
        const second = colourStop(b);
        if (!first || !second) return null;
        const firstWeight = first.percent ?? (second.percent === null ? 50 : 100 - second.percent);
        const secondWeight = 100 - firstWeight;
        // color-mix(in oklab, transparent 90%, var(--x)) is var(--x) at 10%. Of two colours, the lesser
        // is the tint and the greater the surface it sits on, as in `raised 88%, accent 12%`.
        const tintSecond = first.colour === 'transparent' || (second.colour !== 'transparent' && secondWeight < firstWeight);
        const [tint, weight] = tintSecond ? [second.colour, secondWeight] : [first.colour, firstWeight];
        const rgb = channelsOf(tint);
        if (!rgb) return null;
        const alpha = Math.round(weight * 100) / 100;
        return `rgb(${rgb} / ${alpha}%)`;
      };

      /** Rewrite every color-mix() in a value, innermost first. Returns the value unchanged when any is left. */
      const convert = (value) => {
        let out = value;
        for (let guard = 0; guard < 20 && out.includes('color-mix('); guard += 1) {
          const at = out.lastIndexOf('color-mix(');
          let depth = 0;
          let end = -1;
          for (let i = at + 'color-mix'.length; i < out.length; i += 1) {
            if (out[i] === '(') depth += 1;
            else if (out[i] === ')') {
              depth -= 1;
              if (depth === 0) {
                end = i;
                break;
              }
            }
          }
          if (end === -1) return value;
          const replaced = rewrite(out.slice(at + 'color-mix('.length, end));
          if (!replaced) return value;
          out = out.slice(0, at) + replaced + out.slice(end + 1);
        }
        return out.includes('color-mix(') ? value : out;
      };

      root.walkDecls((decl) => {
        if (decl.value.includes('color-mix(')) decl.value = convert(decl.value);
      });

      // A color-mix guard with nothing left to guard: put its rules back in place.
      root.walkAtRules('supports', (rule) => {
        if (!rule.params.includes('color-mix')) return;
        if (rule.toString().replace(rule.params, '').includes('color-mix(')) return;
        rule.replaceWith(rule.nodes ?? []);
      });
    },
  };
};
rgbAlpha.postcss = true;

module.exports = rgbAlpha;
