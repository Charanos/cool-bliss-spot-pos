/* eslint-disable bliss/no-raw-hex -- CSS fixtures: the colours are the input under test */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
// postcss is Tailwind's own dependency; reached through it so the test adds nothing to install.
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss') as (plugins: unknown[]) => { process: (css: string, opts: object) => Promise<{ css: string }> };
const rgbAlpha = require('./postcss-rgb-alpha.cjs');

const TOKENS = ':root{--bliss-accent:#6FC6D6;--bliss-accent-rgb:111 198 214;--bliss-edge-rgb:1 2 3;--color-accent:var(--bliss-accent)}';
const run = async (css: string) => (await postcss([rgbAlpha]).process(TOKENS + css, { from: undefined })).css.slice(TOKENS.length);

describe('translucent colour for every browser (docs/11 D-24)', () => {
  it('turns a tint over transparent into rgb() with channels, through the Tailwind alias', async () => {
    expect(await run('.a{color:color-mix(in oklab,var(--color-accent) 25%,transparent)}')).toBe('.a{color:rgb(var(--bliss-accent-rgb) / 25%)}');
  });

  it('lays the first of two colours over the second at its weight', async () => {
    expect(await run('.a{border-color:color-mix(in oklab,var(--bliss-accent) 45%,var(--bliss-edge))}')).toBe('.a{border-color:rgb(var(--bliss-accent-rgb) / 45%)}');
  });

  it('tints with the lesser of two colours', async () => {
    expect(await run('.a{background:color-mix(in oklab,var(--bliss-edge) 88%,var(--color-accent) 12%)}')).toBe('.a{background:rgb(var(--bliss-accent-rgb) / 12%)}');
  });

  it('reads transparent first, hex colours and several mixes in one value', async () => {
    expect(await run('.a{background:linear-gradient(color-mix(in oklab,transparent 90%,var(--color-accent)),color-mix(in srgb,#ffffff 22%,transparent))}')).toBe(
      '.a{background:linear-gradient(rgb(var(--bliss-accent-rgb) / 10%),rgb(255 255 255 / 22%))}',
    );
  });

  it('unwraps a guard once nothing in it needs guarding, and keeps one that still does', async () => {
    expect(await run('.a{color:var(--color-accent)}@supports (color:color-mix(in lab,red,red)){.a{color:color-mix(in oklab,var(--color-accent) 10%,transparent)}}')).toBe(
      '.a{color:var(--color-accent)}.a{color:rgb(var(--bliss-accent-rgb) / 10%)}',
    );
    const kept = '@supports (color:color-mix(in lab,red,red)){::placeholder{color:color-mix(in oklab,currentcolor 50%,transparent)}}';
    expect(await run(kept)).toBe(kept);
  });

  it('leaves a colour it has no channels for exactly as it was', async () => {
    const css = '.a{color:color-mix(in oklab,var(--unknown) 10%,transparent)}';
    expect(await run(css)).toBe(css);
  });
});
