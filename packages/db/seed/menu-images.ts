/**
 * Photographs for the seeded menu, served from the app (public/products) so a tablet shows them
 * offline and never waits on a photo host. Where each came from, and its licence, is in
 * public/products/CREDITS.md. A product with no match here shows its initial, as before; the owner
 * adds or replaces any photograph in the Console.
 */

/** Matched against a product's name within its section, first match wins. */
const IMAGES: Record<string, [match: RegExp, file: string][]> = {
  beers: [
    [/^Tusker Lager/, 'tusker-lager'],
    [/^Guinness/, 'guinness'],
    [/^Heineken/, 'heineken'],
    [/^White Cap/, 'white-cap'],
    [/^Desperados/, 'desperados'],
    [/^Savanna/, 'savanna'],
    [/^Jinro/, 'jinro-soju'],
  ],
  cans: [[/^Red Bull/, 'red-bull']],
  soft: [
    [/^Soda/, 'soda'],
    [/^Pepsi/, 'pepsi'],
    [/^Mountain Dew/, 'mountain-dew'],
    [/^Tonic/, 'tonic'],
    [/^Monster/, 'monster'],
  ],
  spirits: [
    [/^Smirnoff/, 'smirnoff'],
    [/^Gilbeys/, 'gilbeys'],
    [/^Gordon's/, 'gordons'],
    [/^Captain Morgan/, 'captain-morgan'],
    [/^Jameson/, 'jameson'],
    [/^Black Label/, 'black-label'],
    [/^Red Label/, 'red-label'],
    [/^Chivas/, 'chivas'],
    [/^Hennessy/, 'hennessy'],
    [/^Martell/, 'martell'],
    [/^Baileys/, 'baileys'],
    [/^Amarula/, 'amarula'],
    [/^Jagermeister/, 'jagermeister'],
    [/^Konyagi/, 'konyagi'],
    [/^Grants/, 'grants'],
    [/^Ballantine's/, 'ballantines'],
    [/^Southern Comfort/, 'southern-comfort'],
    [/^VAT 69/, 'vat-69'],
  ],
  wines: [[/\bRed\b/, 'red-wine']],
  shisha: [[/^Shisha/, 'shisha']],
  breakfast: [
    [/^African tea/, 'african-tea'],
    [/^White coffee/, 'white-coffee'],
    [/^Black coffee/, 'black-coffee'],
    [/^Lemon tea/, 'lemon-tea'],
    [/^Chocolate/, 'chocolate'],
    [/^Uji/, 'uji'],
  ],
  snacks: [
    [/^Chapo/, 'chapati'],
    [/^Samosa/, 'samosa'],
    [/eggs, fried/, 'fried-eggs'],
    [/^Boiled egg/, 'boiled-egg'],
    [/^Sausage/, 'sausage'],
    [/^Nduma/, 'nduma'],
  ],
  meals: [
    [/^Beef fry/, 'beef-fry'],
    [/^Goat fry/, 'goat-fry'],
    [/choma$/, 'nyama-choma'],
    [/^Beef stew/, 'beef-stew'],
    [/^Kichwa/, 'kichwa-mbuzi'],
    [/^Chicken kienyeji/, 'chicken-kienyeji'],
    [/^Ugali/, 'ugali'],
    [/^Rice/, 'rice'],
    [/^Mukimo/, 'mukimo'],
    [/^Chips/, 'chips'],
  ],
};

export function menuImage(section: string, name: string): string | null {
  const hit = (IMAGES[section] ?? []).find(([match]) => match.test(name));
  return hit ? `/products/${hit[1]}.webp` : null;
}
