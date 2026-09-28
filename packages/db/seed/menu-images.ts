/**
 * Photographs for the seeded menu, served from the app (public/products) so a tablet shows them
 * offline and never waits on a photo host. Where each came from, and its licence, is in
 * public/products/CREDITS.md.
 *
 * Every product gets one. A brand's own bottle where a free photograph of it exists; otherwise a
 * photograph of what it is (a local whisky shows a whisky in its glass, a local lager a pint), and
 * failing both, its section's picture. The owner replaces any of them in the Console.
 */

type Rule = [match: RegExp, file: string];

/** Matched against a product's name within its section, first match wins. */
const IMAGES: Record<string, Rule[]> = {
  beers: [
    [/^Tusker Lager/, 'tusker-lager'],
    [/^Tusker Cider/, 'tusker-cider'],
    [/^Tusker/, 'tusker-bottles'],
    [/^Guinness/, 'guinness'],
    [/^Heineken/, 'heineken'],
    [/^White Cap/, 'white-cap'],
    [/^Desperados/, 'desperados'],
    [/^Savanna/, 'savanna'],
    [/^Jinro/, 'jinro-soju'],
    [/^Pineapple Punch/, 'pineapple-punch'],
    [/^Black Ice/, 'smirnoff-ice'],
    [/^Raspberry/, 'raspberry'],
    [/^(Hunters|Manyatta)/, 'cider'],
  ],
  cans: [
    [/^Tusker Cider/, 'tusker-cider'],
    [/^Tusker/, 'tusker-bottles'],
    [/^White Cap/, 'white-cap'],
    [/^Guinness/, 'guinness'],
    [/^Heineken/, 'heineken-can'],
    [/^Pineapple Punch/, 'pineapple-punch'],
    [/^Black Ice/, 'smirnoff-ice'],
    [/^Raspberry/, 'raspberry'],
    [/^Guarana/, 'guarana'],
    [/^(Manyatta|Snapp)/, 'cider'],
    [/^Red Bull/, 'red-bull'],
    [/^Gordon's Pink/, 'gordons-pink'],
    [/^Gordon's/, 'gordons-can'],
    [/^Faxe/, 'faxe'],
  ],
  soft: [
    [/^Soda/, 'soda'],
    [/^Dasani/, 'dasani'],
    [/^Minute Maid/, 'minute-maid'],
    [/^Monster/, 'monster'],
    [/^Predator/, 'predator'],
    [/^(Charged|Sweepers)/, 'energy'],
    [/^Tonic/, 'tonic'],
    [/^Del Monte/, 'del-monte'],
    [/^Lemonade/, 'lemonade'],
    [/^Pepsi/, 'pepsi'],
    [/^7 Up/, '7up'],
    [/^Mountain Dew/, 'mountain-dew'],
    [/^Lime juice/, 'lime-juice'],
    [/^Water/, 'water'],
  ],
  spirits: [
    [/^Cosmo /, 'cosmopolitan'],
    [/^Smirnoff/, 'smirnoff'],
    [/^Gilbeys/, 'gilbeys'],
    [/^Gordon's/, 'gordons'],
    [/^Captain Morgan/, 'captain-morgan'],
    [/^Jameson/, 'jameson'],
    [/^Jack Daniel's/, 'jack-daniels'],
    [/^Double Black/, 'double-black'],
    [/^Black Label/, 'black-label'],
    [/^Red Label/, 'red-label'],
    [/^Chivas/, 'chivas'],
    [/^Glenfiddich/, 'glenfiddich'],
    [/^Famous Grouse/, 'famous-grouse'],
    [/^Singleton/, 'singleton'],
    [/^Hennessy/, 'hennessy'],
    [/^Martell/, 'martell'],
    [/^Remy Martin/, 'remy-martin'],
    [/^Baileys/, 'baileys'],
    [/^Amarula/, 'amarula'],
    [/^Best Cream/, 'cream-liqueur'],
    [/^Jagermeister/, 'jagermeister'],
    [/^Konyagi/, 'konyagi'],
    [/^Grants/, 'grants'],
    [/^Ballantine's/, 'ballantines'],
    [/^Southern Comfort/, 'southern-comfort'],
    [/^VAT 69/, 'vat-69'],
    [/^Napoleon/, 'napoleon'],
    // Brandies by the glass; clear spirits, cane and tequila by the clear glass; the rest whisky.
    [/^(County|Richot|Viceroy)/, 'brandy-glass'],
    [/^(KC|Chrome|Kibao|Kane Extra|Camino)/, 'clear-spirit'],
    [/^(Hunters Choice|Bond 7|Best Whisky|John Barr|Black & White|Hamptons|Royal Circle)/, 'whisky-glass'],
  ],
  wines: [
    [/^Nederburg/, 'nederburg'],
    [/^Kiss Me/, 'rose-wine'],
    [/\b(White|Bianco)\b/, 'white-wine'],
  ],
  cigarettes: [
    [/^Dunhill/, 'dunhill'],
    [/^Pall Mall/, 'pall-mall'],
    [/^Rothmans/, 'rothmans'],
  ],
  shisha: [[/^Shisha/, 'shisha']],
  breakfast: [
    [/^African tea/, 'african-tea'],
    [/^White coffee/, 'white-coffee'],
    [/^Black coffee/, 'black-coffee'],
    [/^Lemon tea/, 'lemon-tea'],
    [/^Milk/, 'milk'],
    [/^Chocolate/, 'chocolate'],
    [/^Uji/, 'uji'],
    [/^Bone soup/, 'bone-soup'],
  ],
  snacks: [
    [/^Chapo/, 'chapati'],
    [/^Samosa/, 'samosa'],
    [/^Rolex/, 'rolex'],
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
    [/^Matumbo/, 'matumbo'],
    [/^Kichwa/, 'kichwa-mbuzi'],
    [/^Chicken kienyeji/, 'chicken-kienyeji'],
    [/^Ugali/, 'ugali'],
    [/^Rice/, 'rice'],
    [/^Mukimo/, 'mukimo'],
    [/^Chips/, 'chips'],
  ],
};

/** A section's own picture, for anything its rules do not name. */
const SECTION: Record<string, string> = {
  beers: 'lager',
  cans: 'lager',
  soft: 'soda',
  spirits: 'whisky-glass',
  wines: 'red-wine',
  cigarettes: 'cigarettes',
  shisha: 'shisha',
  breakfast: 'african-tea',
  snacks: 'samosa',
  meals: 'nyama-choma',
};

export function menuImage(section: string, name: string): string | null {
  const file = (IMAGES[section] ?? []).find(([match]) => match.test(name))?.[1] ?? SECTION[section];
  return file ? `/products/${file}.webp` : null;
}

/** Whether a product took its section's picture rather than one of its own; a test keeps these few. */
export function usesSectionImage(section: string, name: string): boolean {
  return !(IMAGES[section] ?? []).some(([match]) => match.test(name));
}
