// Draws the Cool Bliss logo and mark as vector into public/brand: a gold wine glass whose stem runs
// straight down into the I of BLISS, the I's foot serving as the glass's foot, redrawn from the
// original artwork (logo.pdf) without its background or tagline. Letters are Playfair Display
// outlines (SIL Open Font License), so the logo needs no font on any device.
//
// Not part of the build. To redraw: put PlayfairDisplay-Bold (700) and -Black (900) TTFs beside
// this file as pf700.ttf and pf900.ttf, `npm i opentype.js@2` in a scratch folder, then
//   node scripts/brand/make-logo.cjs public/brand
// and render the PNGs from the SVGs (logo-2048.png, mark-on-dark-1024.png and the rest).
/* global require, __dirname, process, console */
/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS script run with node */
const opentype = require('opentype.js');
const fs = require('fs');

const bold = opentype.parse(fs.readFileSync(__dirname + '/pf700.ttf').buffer);
const black = opentype.parse(fs.readFileSync(__dirname + '/pf900.ttf').buffer);
const r = (n) => Math.round(n * 100) / 100;

// ---- the word BLISS ------------------------------------------------------------------------------
const CAP = 108; // cap height of BLISS, px
const size = (CAP / 708) * 1000; // font size that gives that cap height
const k = size / 1000;
const tracking = 34; // font units between letters
const word = 'BLISS';
const advances = [...word].map((ch) => bold.charToGlyph(ch).advanceWidth);
const wordWidth = (advances.reduce((a, b) => a + b, 0) + tracking * (word.length - 1)) * k;

const W = 520; // viewBox width
const startX = (W - wordWidth) / 2;
const xs = [];
let x = startX;
for (let i = 0; i < word.length; i++) {
  xs.push(x);
  x += (advances[i] + tracking) * k;
}
// The I's stem, in px: from its glyph outline (109 to 268 font units).
const iX = xs[2];
const stemL = iX + 109 * k;
const stemR = iX + 268 * k;
const cx = (stemL + stemR) / 2;

// ---- the glass, centred on the I -----------------------------------------------------------------
const rimY = 14;
const bowlBottom = 318;
const baseline = 520;
const capTop = baseline - CAP;
const rimHalf = 106;
const bellyHalf = 150;
const stroke = 9;
// The bowl's centre line (the gold is a stroke along it): flat rim, swelling sides, a round base
// that closes into the stem.
const bowl = [
  `M ${r(cx - rimHalf)} ${rimY}`,
  `L ${r(cx + rimHalf)} ${rimY}`,
  `C ${r(cx + rimHalf + 16)} ${rimY + 60} ${r(cx + bellyHalf + 2)} ${rimY + 128} ${r(cx + bellyHalf)} ${rimY + 188}`,
  `C ${r(cx + bellyHalf - 2)} ${rimY + 250} ${r(cx + 78)} ${bowlBottom - 6} ${r(cx)} ${bowlBottom}`,
  `C ${r(cx - 78)} ${bowlBottom - 6} ${r(cx - bellyHalf + 2)} ${rimY + 250} ${r(cx - bellyHalf)} ${rimY + 188}`,
  `C ${r(cx - bellyHalf - 2)} ${rimY + 128} ${r(cx - rimHalf - 16)} ${rimY + 60} ${r(cx - rimHalf)} ${rimY}`,
  'Z',
].join(' ');

// The stem: flares out of the base of the bowl, narrows to the I's stem, and runs straight down to
// the top of the I's foot serif, so glass and letter are one stroke.
const footTop = baseline - (106 + 6) * k; // just above where the I's foot serif begins to spread
const flareY = bowlBottom + 34;
const stem = [
  `M ${r(cx - 34)} ${bowlBottom - 2}`,
  `C ${r(cx - 14)} ${bowlBottom + 4} ${r(stemL)} ${flareY - 16} ${r(stemL)} ${flareY}`,
  `L ${r(stemL)} ${r(footTop)}`,
  `L ${r(stemR)} ${r(footTop)}`,
  `L ${r(stemR)} ${flareY}`,
  `C ${r(stemR)} ${flareY - 16} ${r(cx + 14)} ${bowlBottom + 4} ${r(cx + 34)} ${bowlBottom - 2}`,
  'Z',
].join(' ');

// The wine: below a gentle wave, clipped to the inside of the bowl.
const wave = [
  `M ${r(cx - 175)} ${rimY + 120}`,
  `C ${r(cx - 95)} ${rimY + 92} ${r(cx - 40)} ${rimY + 150} ${r(cx + 40)} ${rimY + 142}`,
  `C ${r(cx + 105)} ${rimY + 136} ${r(cx + 140)} ${rimY + 108} ${r(cx + 175)} ${rimY + 104}`,
  `L ${r(cx + 175)} ${bowlBottom + 20} L ${r(cx - 175)} ${bowlBottom + 20} Z`,
].join(' ');

// The C in the glass: large, a little high, so its top rises out of the wine as in the original.
const cSize = 250;
const cGlyph = black.charToGlyph('C');
const cBox = cGlyph.getBoundingBox();
const cW = ((cBox.x2 - cBox.x1) * cSize) / 1000;
const cH = ((cBox.y2 - cBox.y1) * cSize) / 1000;
const cX = cx - cW / 2 - (cBox.x1 * cSize) / 1000 + 4;
const cBase = rimY + 178 + cH / 2 - 10;
const cPath = cGlyph.getPath(cX, cBase, cSize).toPathData(2);

// The letters: B, L, the I's foot alone (its stem is the glass stem), S, S.
const letter = (i) => bold.charToGlyph(word[i]).getPath(xs[i], baseline, size).toPathData(2);
const iFoot = letter(2);

// COOL, small, to the left of the stem and sitting on the top of BLISS, as in the original.
const coolSize = size * 0.4;
const coolTrack = 60;
const coolAdv = [...'COOL'].map((ch) => bold.charToGlyph(ch).advanceWidth);
const coolW = (coolAdv.reduce((a, b) => a + b, 0) + coolTrack * 3) * (coolSize / 1000);
let coolX = stemL - 14 - coolW;
const coolBase = capTop - 12;
const cool = [...'COOL']
  .map((ch, i) => {
    const d = bold.charToGlyph(ch).getPath(coolX, coolBase, coolSize).toPathData(2);
    coolX += (coolAdv[i] + coolTrack) * (coolSize / 1000);
    return d;
  })
  .join(' ');

const H = baseline + 14;

function svg({ gold, wine, cream, cStroke, title }) {
  const goldFill = gold === 'gradient' ? 'url(#gold)' : gold;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9a6a14"/>
      <stop offset="0.28" stop-color="#e2b64a"/>
      <stop offset="0.46" stop-color="#f6dc8c"/>
      <stop offset="0.62" stop-color="#cf9b2e"/>
      <stop offset="0.82" stop-color="#eac25c"/>
      <stop offset="1" stop-color="#8f5f10"/>
    </linearGradient>
    <clipPath id="inside"><path d="${bowl}"/></clipPath>
    <clipPath id="foot"><rect x="0" y="${r(footTop - 1)}" width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#inside)">
    <path d="${wave}" fill="${wine}"/>
    <path d="${cPath}" fill="${cream}" stroke="${cStroke}" stroke-width="3" paint-order="stroke" stroke-linejoin="round"/>
  </g>
  <path d="${bowl}" fill="none" stroke="${goldFill}" stroke-width="${stroke}" stroke-linejoin="round"/>
  <g fill="${goldFill}">
    <path d="${stem}"/>
    <path d="${letter(0)}"/>
    <path d="${letter(1)}"/>
    <path d="${iFoot}" clip-path="url(#foot)"/>
    <path d="${letter(3)}"/>
    <path d="${letter(4)}"/>
    <path d="${cool}"/>
  </g>
</svg>
`;
}

// The emblem: the glass alone, standing on a short stem and a foot, for small sizes and app icons.
function emblem({ gold, wine, cream, cStroke }) {
  const goldFill = gold === 'gradient' ? 'url(#egold)' : gold;
  const top = rimY - stroke;
  const footY = bowlBottom + 70;
  const size = footY + 14 - top + 24;
  const left = cx - size / 2;
  const estem = [
    `M ${r(cx - 34)} ${bowlBottom - 2}`,
    `C ${r(cx - 14)} ${bowlBottom + 4} ${r(cx - 6)} ${flareY - 16} ${r(cx - 6)} ${flareY}`,
    `L ${r(cx - 6)} ${footY - 10}`,
    `C ${r(cx - 6)} ${footY - 2} ${r(cx - 40)} ${footY} ${r(cx - 62)} ${footY + 2}`,
    `L ${r(cx - 62)} ${footY + 10} L ${r(cx + 62)} ${footY + 10} L ${r(cx + 62)} ${footY + 2}`,
    `C ${r(cx + 40)} ${footY} ${r(cx + 6)} ${footY - 2} ${r(cx + 6)} ${footY - 10}`,
    `L ${r(cx + 6)} ${flareY}`,
    `C ${r(cx + 6)} ${flareY - 16} ${r(cx + 14)} ${bowlBottom + 4} ${r(cx + 34)} ${bowlBottom - 2}`,
    'Z',
  ].join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(left)} ${r(top - 12)} ${r(size)} ${r(size)}" role="img" aria-label="Cool Bliss">
  <title>Cool Bliss</title>
  <defs>
    <linearGradient id="egold" x1="${r(left)}" y1="${r(top)}" x2="${r(left + size)}" y2="${r(top + size)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9a6a14"/>
      <stop offset="0.3" stop-color="#e2b64a"/>
      <stop offset="0.5" stop-color="#f6dc8c"/>
      <stop offset="0.7" stop-color="#cf9b2e"/>
      <stop offset="1" stop-color="#8f5f10"/>
    </linearGradient>
    <clipPath id="einside"><path d="${bowl}"/></clipPath>
  </defs>
  <g clip-path="url(#einside)">
    <path d="${wave}" fill="${wine}"/>
    <path d="${cPath}" fill="${cream}" stroke="${cStroke}" stroke-width="3" paint-order="stroke" stroke-linejoin="round"/>
  </g>
  <path d="${bowl}" fill="none" stroke="${goldFill}" stroke-width="${stroke + 3}" stroke-linejoin="round"/>
  <path d="${estem}" fill="${goldFill}"/>
</svg>
`;
}

const out = process.argv[2];
fs.writeFileSync(`${out}/mark.svg`, emblem({ gold: 'gradient', wine: '#1b1916', cream: '#fbf7ee', cStroke: '#1b1916' }));
fs.writeFileSync(`${out}/mark-on-dark.svg`, emblem({ gold: 'gradient', wine: '#2c2621', cream: '#fbf7ee', cStroke: '#1b1916' }));
fs.writeFileSync(`${out}/logo.svg`, svg({ gold: 'gradient', wine: '#1b1916', cream: '#fbf7ee', cStroke: '#1b1916', title: 'Cool Bliss' }));
// For a dark screen: the wine lifts a little so the glass reads against the page.
fs.writeFileSync(`${out}/logo-on-dark.svg`, svg({ gold: 'gradient', wine: '#2c2621', cream: '#fbf7ee', cStroke: '#1b1916', title: 'Cool Bliss' }));
// For thermal paper: one ink, no gradient, the C left as paper.
fs.writeFileSync(`${out}/logo-ink.svg`, svg({ gold: '#000000', wine: '#000000', cream: '#ffffff', cStroke: '#000000', title: 'Cool Bliss' }));
console.log('viewBox', W, H, 'stem', r(stemL), r(stemR), 'I at', r(iX));
