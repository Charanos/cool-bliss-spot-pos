import type { Category, CategoryColourToken, Modifier, ModifierGroup, PriceListItem, Product, ProductVariant, StockMovement, VariantModifierGroup } from '@bliss/shared/domain';
import { shillings, ZERO } from '@bliss/shared/money';
import type { IsoDate } from '@bliss/shared/time';
import { seedId } from './ids';
import { menuImage } from './menu-images';
import { OUTLET } from './organisation';

/**
 * The real menu, as printed on the Cool Bliss stock sheet and the Bliss Kitchen menu: every line
 * with its selling price. Drinks are one product per line, sold sealed; a dish in several sizes is
 * one product with a way to sell each size. docs/17 section 3.
 *
 * Every drink opens with one in stock on the Bar shelf, so its stock counts as recorded from the
 * start. The stock take replaces these ones with what is really there, as count adjustments. Food
 * and shisha keep no stock: their categories do not track it, so they are never "finished".
 *
 * Corrections from the owner over the sheet: Smirnoff 750ml is 2,000 (the sheet prints 200), Black
 * Label is 5,000 and 6,000 for 750ml and a litre, and Martell VS and VSOP come in 750ml and a litre.
 * Remy Martin appears twice at different prices; each carries its price in the name until the
 * owner renames it.
 */

interface Line {
  name: string;
  price: number;
  ml?: number;
  /** Sizes or sides sold under one tile, each its own price: [label, price]. The first is the default. */
  options?: [label: string, price: number][];
  /** How many the house owns, for something served and handed back: shisha pots. */
  inHouse?: number;
  /** A choice asked for on the floor when it is ordered: the key of a group in CHOICES. */
  choice?: keyof typeof CHOICES;
}

/**
 * Choices asked for when an item is ordered, as modifier groups the Floor already knows how to ask.
 * A shisha pot takes one flavour, or two mixed; anything else the guest asks for goes in its note.
 */
export const CHOICES = {
  flavour: {
    name: 'Shisha flavour',
    minSelect: 1,
    maxSelect: 2,
    options: ['Double apple', 'Mint', 'Grape', 'Grape mint', 'Watermelon', 'Watermelon mint', 'Blueberry', 'Lemon mint', 'Peach', 'Mango', 'Orange', 'Strawberry', 'Gum mint', 'Mixed fruit'],
  },
} as const;

interface Section {
  key: string;
  name: string;
  colour: CategoryColourToken;
  /** Added to a product's SKU so a Tusker bottle and a Tusker can never share one. */
  code: string;
  /** Where its orders print. The bar unless it is food. */
  routing?: 'bar' | 'kitchen';
  /** False for what is made or served, not counted: food and shisha keep no stock. */
  tracked?: boolean;
  lines: Line[];
}

const l = (name: string, price: number, ml?: number): Line => ({ name, price, ml });

/** One dish in several sizes or with several sides, on one tile: "Beef fry" at half a kilo or one. */
const o = (name: string, ...options: [label: string, price: number][]): Line => ({ name, price: options[0]![1], options });

/** A brand sold in several bottle sizes: one line per size, named "Gilbeys 250ml". */
const sizes = (brand: string, ...pairs: [ml: number, price: number][]): Line[] => pairs.map(([ml, price]) => l(`${brand} ${ml === 1000 ? '1 litre' : `${ml}ml`}`, price, ml));

export const MENU: Section[] = [
  {
    key: 'beers',
    name: 'Beers',
    colour: 'brass',
    code: 'BER',
    lines: [
      l('Tusker Lager', 250),
      l('Tusker Malt', 250),
      l('Tusker Lite', 250),
      l('Tusker Cider', 280),
      l('Tusker Ndimu', 250),
      l('Balozi', 250),
      l('White Cap', 260),
      l('White Cap Light', 250),
      l('Guinness', 280),
      l('Guinness Smooth', 280),
      l('Pilsner', 250),
      l('Pineapple Punch', 300),
      l('Heineken', 300),
      l('Heineken Zero', 300),
      l('Black Ice', 300),
      l('Desperados', 300),
      l('Savanna', 300),
      l('Savanna Lemon', 300),
      l('Hunters Gold', 300),
      l('Hunters Dry', 300),
      l('Raspberry', 300),
      l('Manyatta', 300),
      l('Jinro Soju', 450),
      l('KO', 300),
      l('Summit', 250),
    ],
  },
  {
    key: 'cans',
    name: 'Cans',
    colour: 'ember',
    code: 'CAN',
    lines: [
      l('Tusker Lager can', 300),
      l('Tusker Malt can', 300),
      l('Tusker Lite can', 300),
      l('Tusker Cider can', 300),
      l('Balozi can', 300),
      l('White Cap can', 300),
      l('Guinness can', 300),
      l('Guinness Smooth can', 300),
      l('Pineapple Punch can', 300),
      l('Heineken can', 350),
      l('Guarana can', 300),
      l('Black Ice can', 300),
      l('Raspberry can', 300),
      l('Manyatta can', 300),
      l('Snapp can', 300),
      l('Red Bull can', 300),
      l("Gordon's Dry can", 300),
      l("Gordon's Pink can", 300),
      l('Faxe can', 350),
    ],
  },
  {
    key: 'soft',
    name: 'Soft drinks',
    colour: 'jade',
    code: 'SFT',
    lines: [
      l('Soda 300ml', 70, 300),
      l('Soda 500ml bottle', 100, 500),
      l('Soda 500ml plastic', 100, 500),
      l('Soda 1 litre plastic', 150, 1000),
      l('Soda 1.25 litres', 170, 1250),
      l('Dasani 1 litre', 100, 1000),
      l('Dasani 500ml', 50, 500),
      l('Minute Maid 1 litre', 200, 1000),
      l('Minute Maid 500ml', 100, 500),
      l('Monster', 400),
      l('Charged', 80),
      l('Sweepers', 100),
      l('Predator', 100),
      l('Tonic', 100),
      l('Del Monte', 300),
      l('Lemonade', 70),
      l('Pepsi', 100),
      l('7 Up', 100),
      l('Mountain Dew', 100),
      l('Lime juice', 100),
      l('Water 1 litre', 100, 1000),
      l('Water 500ml', 50, 500),
    ],
  },
  {
    key: 'spirits',
    name: 'Spirits',
    colour: 'glacier',
    code: 'SPR',
    lines: [
      ...sizes('KC', [250, 350], [375, 600], [750, 1100]),
      ...sizes('Chrome', [250, 300], [750, 1000]),
      ...sizes('Captain Morgan', [250, 450], [750, 1400]),
      ...sizes('County', [250, 300], [750, 900]),
      ...sizes('Hunters Choice', [250, 400], [750, 1300]),
      ...sizes('Gilbeys', [250, 550], [375, 850], [750, 1600]),
      ...sizes('Richot', [250, 550], [375, 850], [750, 2000]),
      ...sizes('Viceroy', [250, 650], [375, 900], [750, 2200]),
      ...sizes('Smirnoff', [250, 550], [375, 850], [750, 2000]),
      ...sizes('Kibao', [250, 300], [375, 500], [750, 1000]),
      l('Napoleon', 300),
      ...sizes('Kane Extra', [250, 350], [750, 1100]),
      l('Cosmo Smirnoff', 1200),
      l('Cosmo Gilbeys', 1200),
      l('Cosmo Captain', 1200),
      ...sizes('Konyagi', [250, 550], [375, 800]),
      ...sizes("Gordon's", [375, 1400], [750, 2500]),
      ...sizes('VAT 69', [375, 1200], [750, 1800]),
      ...sizes('Bond 7', [250, 650], [375, 900], [750, 1800]),
      ...sizes("Jack Daniel's", [375, 2500], [750, 4500], [1000, 5500]),
      ...sizes('Red Label', [375, 1500], [750, 2500], [1000, 2800]),
      ...sizes('Black Label', [375, 2500], [750, 5000], [1000, 6000]),
      ...sizes('Double Black', [750, 6500], [1000, 9000]),
      ...sizes('Grants', [750, 2800]),
      ...sizes('Camino', [750, 2500]),
      ...sizes('Camino T', [750, 2500]),
      ...sizes('Jameson', [750, 3000], [1000, 3500]),
      ...sizes('Best Whisky', [750, 1500]),
      ...sizes('Best Cream', [750, 1600]),
      ...sizes('John Barr', [750, 2100], [1000, 2600]),
      l('Glenfiddich 12', 13500, 750),
      l('Glenfiddich 15', 15500, 750),
      l('Glenfiddich 18', 18500, 750),
      ...sizes('Chivas', [750, 6500]),
      ...sizes("Ballantine's", [750, 3000]),
      ...sizes('Famous Grouse', [1000, 3500]),
      l('Southern Comfort', 3500),
      l('Hamptons drum', 2000),
      l('Black & White', 1800),
      l('Amarula', 3000),
      l('Singleton 12', 7500),
      l('Singleton 15', 9000),
      l('Baileys', 3000),
      l('Jagermeister', 3500),
      l('Royal Circle', 2000),
      l('Hennessy VS', 7500),
      l('Hennessy VSOP', 12000),
      ...sizes('Martell VS', [750, 8500], [1000, 11500]),
      ...sizes('Martell VSOP', [750, 11000], [1000, 13500]),
      l('Remy Martin (11,500)', 11500),
      l('Remy Martin (15,000)', 15000),
    ],
  },
  {
    key: 'wines',
    name: 'Wines',
    colour: 'iris',
    code: 'WIN',
    lines: [
      l('Caprice Red 1 litre', 1100, 1000),
      l('Caprice White 1 litre', 1100, 1000),
      l('Casabuena', 1100),
      l('4th Street Red Sweet 1 litre', 2000, 1000),
      l('4th Street White Sweet 1 litre', 2000, 1000),
      l('Drostdy-Hof Red 750ml', 1500, 750),
      l('Nederburg 750ml', 2000, 750),
      l('Robertson Red 750ml', 1600, 750),
      l('4th Street White 750ml', 1500, 750),
      l('4th Street Red 750ml', 1500, 750),
      l('Four Cousins Red 750ml', 1500, 750),
      l('Four Cousins White 750ml', 1500, 750),
      l('Rosso Nobile', 2500),
      l('Asconi', 2500),
      l('Kiss Me', 2500),
      l('Black Bird', 1500),
      l('Cellar Cask', 1500),
      l('Bianco Nobile', 2500),
    ],
  },
  {
    key: 'cigarettes',
    name: 'Cigarettes',
    colour: 'steel',
    code: 'CIG',
    lines: [
      l('Dunhill Embassy B', 600),
      l('Dunhill Embassy W', 600),
      l('Dunhill Single', 600),
      l('Dunhill Double', 600),
      l('Pall Mall Red', 200),
      l('Pall Mall Green S', 300),
      l('Pall Mall Blue S', 300),
      l('Rothmans', 400),
      l('Embassy', 600),
    ],
  },
  {
    key: 'shisha',
    name: 'Shisha',
    colour: 'rose',
    code: 'SHI',
    tracked: false,
    // Four pots in the house. A pot is served and comes back, so what is counted is how many are
    // out on tables, not stock; the floor asks for the flavour, and the note takes the rest.
    lines: [{ ...l('Shisha pot', 1000), inHouse: 4, choice: 'flavour' }],
  },
  // Bliss Kitchen, from its printed menu. Made to order, so nothing is counted.
  {
    key: 'breakfast',
    name: 'Breakfast',
    colour: 'brass',
    code: 'BRK',
    routing: 'kitchen',
    tracked: false,
    lines: [
      l('African tea', 50),
      l('White coffee', 50),
      l('Black coffee', 40),
      l('Lemon tea', 50),
      l('Milk', 70),
      l('Chocolate', 50),
      l('Uji power', 100),
      l('Bone soup', 50),
    ],
  },
  {
    key: 'snacks',
    name: 'Snacks',
    colour: 'leaf',
    code: 'SNK',
    routing: 'kitchen',
    tracked: false,
    lines: [
      l('Chapo', 30),
      l('Samosa', 50),
      l('Rolex', 80),
      l('2 eggs, fried', 70),
      l('Boiled egg', 30),
      l('Sausage', 50),
      l('Nduma', 50),
    ],
  },
  {
    key: 'meals',
    name: 'Meals',
    colour: 'ember',
    code: 'MEA',
    routing: 'kitchen',
    tracked: false,
    lines: [
      o('Beef fry', ['half kg', 600], ['1 kg', 1200]),
      o('Goat fry', ['half kg', 700], ['1 kg', 1400]),
      o('Beef choma', ['half kg', 600], ['1 kg', 1200]),
      o('Goat choma', ['half kg', 700], ['1 kg', 1400]),
      o('Beef stew', ['with chapo, ugali or rice', 250], ['with mukimo', 300]),
      o('Matumbo stew', ['with chapo, ugali or rice', 200]),
      o('Kichwa mbuzi', ['half', 300], ['full', 600]),
      o('Chicken kienyeji', ['half', 700], ['full', 1400]),
      l('Ugali portion', 50),
      l('Rice portion', 50),
      l('Mukimo plain', 100),
      l('Chips', 150),
    ],
  },
];

/** A readable SKU from the section and the name: BER-TUSKER-LAGER, SPR-GILBEYS-250ML. */
function skuOf(code: string, name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return [code, ...words].join('-').slice(0, 32).replace(/-+$/, '');
}

// No stock is opened: every drink starts "Not counted yet" and on sale until its first delivery or
// count (D-30, D-32). `movements` stays in the result, empty, for the callers that add it.
export function buildMenu(_input: { now: number; businessDate: IsoDate; ownerId: string }) {
  const outletId = OUTLET.id;
  const standard = seedId('pricelist:standard');
  const categories: Category[] = [];
  const products: Product[] = [];
  const variants: ProductVariant[] = [];
  const priceListItems: PriceListItem[] = [];
  const movements: StockMovement[] = [];
  const modifierGroups: ModifierGroup[] = [];
  const modifiers: Modifier[] = [];
  const variantModifierGroups: VariantModifierGroup[] = [];
  const skus = new Set<string>();

  (Object.keys(CHOICES) as (keyof typeof CHOICES)[]).forEach((key, g) => {
    const choice = CHOICES[key];
    const groupId = seedId(`menu:choice:${key}`);
    modifierGroups.push({ id: groupId, outletId, name: choice.name, minSelect: choice.minSelect, maxSelect: choice.maxSelect, isRequired: choice.minSelect > 0, sortOrder: g + 1, status: 'active' });
    choice.options.forEach((name, i) => modifiers.push({ id: seedId(`menu:choice:${key}:${name}`), modifierGroupId: groupId, name, priceDeltaCents: ZERO, linkedVariantId: null, sortOrder: i + 1, status: 'active' }));
  });

  MENU.forEach((section, s) => {
    const categoryId = seedId(`menu:category:${section.key}`);
    const tracked = section.tracked !== false;
    categories.push({ id: categoryId, outletId, parentId: null, name: section.name, sortOrder: s + 1, routingTarget: section.routing ?? 'bar', colourToken: section.colour, trackStock: tracked, status: 'active' });
    for (const line of section.lines) {
      const sku = skuOf(section.code, line.name);
      if (skus.has(sku)) throw new Error(`Two menu lines make the SKU ${sku}.`);
      skus.add(sku);
      const productId = seedId(`menu:product:${sku}`);
      const variantId = seedId(`menu:variant:${sku}`);
      const options = line.options ?? [[null, line.price] as const];
      products.push({
        id: productId,
        outletId,
        categoryId,
        name: line.name,
        brand: null,
        sku,
        barcode: null,
        containerVolumeMl: line.ml ?? null,
        abv: null,
        isSoldSealed: true,
        isSoldByServe: false,
        lowStockThreshold: null,
        unitsInHouse: line.inHouse ?? null,
        reorderPoint: 0,
        reorderQty: 1,
        leadTimeDays: 2,
        defaultSupplierId: null,
        imageKey: menuImage(section.key, line.name),
        status: 'active',
      });
      options.forEach(([label, price], i) => {
        // The first keeps the id a one-size line has always had, so a reseed never orphans it.
        const id = i === 0 ? variantId : seedId(`menu:variant:${sku}:${i}`);
        variants.push({ id, outletId, productId, name: label ? `${line.name}, ${label}` : line.name, kind: 'sealed', serveVolumeMl: null, depletionFactor: 1, barcode: null, isDefault: i === 0, sortOrder: i + 1, status: 'active' });
        priceListItems.push({ id: i === 0 ? seedId(`menu:price:${sku}`) : seedId(`menu:price:${sku}:${i}`), priceListId: standard, productVariantId: id, priceCents: shillings(price), minQty: null, status: 'active' });
        if (line.choice) variantModifierGroups.push({ productVariantId: id, modifierGroupId: seedId(`menu:choice:${line.choice}`), sortOrder: 1 });
      });
    }
  });

  return { categories, products, variants, priceListItems, movements, modifierGroups, modifiers, variantModifierGroups };
}
