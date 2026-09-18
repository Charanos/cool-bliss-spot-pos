import type {
  Category,
  CategoryColourToken,
  Modifier,
  ModifierGroup,
  PriceList,
  PriceListItem,
  PriceRule,
  Product,
  ProductVariant,
  VariantModifierGroup,
} from '@bliss/shared/domain';
import { type Cents, shillings } from '@bliss/shared/money';
import { seedId } from './ids';
import { OUTLET, supplierByKey } from './organisation';

/**
 * The Cool Bliss Spot catalogue. Products carry serve sizes off one bottle, so the bar and the
 * bottle counter share one stock pool: a Gilbeys tot, a double and a sealed bottle all deplete the
 * same Gilbeys 750ml stock variant.
 */

export const CATALOGUE_VERSION = 14;

const outletId = OUTLET.id;

const category = (key: string, name: string, sortOrder: number, colourToken: CategoryColourToken, routingTarget: Category['routingTarget'], trackStock: boolean): Category => ({
  id: seedId(`category:${key}`),
  outletId,
  parentId: null,
  name,
  sortOrder,
  routingTarget,
  colourToken,
  trackStock,
  status: 'active',
});

export const CATEGORIES: Category[] = [
  category('beer', 'Beer', 1, 'brass', 'bar', true),
  category('spirits', 'Spirits', 2, 'glacier', 'bar', true),
  category('wine', 'Wine', 3, 'iris', 'bar', true),
  category('soft', 'Soft drinks', 4, 'jade', 'bar', true),
  category('food', 'Food', 5, 'leaf', 'kitchen', false),
];

/** Photographs selected for the tile imagery decision. Keys resolve through the asset store. */
const PHOTO = {
  tusker: '1608270586620-248524c67de9',
  lite: '1566633806327-68e152aaf26d',
  whitecap: '1567696911980-2eed69a46042',
  balozi: '1600788886242-5c96aabe3757',
  guinness: '1571613316887-6f8d5cbf7ef7',
  heineken: '1618885472179-5e474019f2a9',
  pilsner: '1436076863939-06870fe779c2',
  summit: '1514218953589-2d7d37efd2dc',
  gilbeys: '1608885898957-a559228e8749',
  gilbeysDouble: '1621263764928-df1444c5e859',
  smirnoff: '1582106245687-cbb466a9f07f',
  cane: '1569529465841-dfecdab7503b',
  morgan: '1517620430776-0ec904756579',
  jameson: '1527281400683-1aae777175f8',
  hunters: '1587223962930-cb7f31384c19',
  cousins: '1510812431401-41d2bd2722f3',
  nederburg: '1474722883778-792e7990302f',
  drostdy: '1563227812-0ea4c22e6cc8',
  coke: '1554866585-cd94860890b7',
  fanta: '1516997121675-4c2d1684aa3e',
  sprite: '1551538827-9c037cb4f32a',
  dasani: '1548839140-29a749e1cf4d',
  redbull: '1622543925917-763c34d1a86e',
  tonic: '1581006852262-e4307cf6283a',
  nyama: '1544025162-d76694265947',
  mishkaki: '1555939594-58d7cb561ad1',
  kachumbari: '1512621776951-a57141f2eefd',
  tilapia: '1519708227418-c8fd9a32b7a2',
} as const;

export interface SeedProductSpec {
  key: string;
  name: string;
  brand: string | null;
  category: 'beer' | 'spirits' | 'wine' | 'soft' | 'food';
  sku: string;
  photo: keyof typeof PHOTO;
  containerMl: number | null;
  abv: number | null;
  supplier: 'rift' | 'kariuki' | 'coast' | null;
  /** Low stock threshold in stock units: bottles or units. */
  threshold: number | null;
  reorderPoint: number;
  reorderQty: number;
  /** Cost of one stock unit, in shillings. */
  unitCost: number;
  variants: {
    key: string;
    name: string;
    kind: 'sealed' | 'serve';
    serveMl: number | null;
    price: number;
    isDefault: boolean;
    happyHour?: number;
    photo?: keyof typeof PHOTO;
  }[];
}

const beer = (key: string, name: string, sku: string, photo: keyof typeof PHOTO, ml: number, price: number, cost: number, happy?: number): SeedProductSpec => ({
  key,
  name,
  brand: name.split(' ')[0] ?? null,
  category: 'beer',
  sku,
  photo,
  containerMl: ml,
  abv: 4.2,
  supplier: 'rift',
  threshold: 12,
  reorderPoint: 120,
  reorderQty: 240,
  unitCost: cost,
  variants: [{ key: 'bottle', name: `${name} ${ml}ml`, kind: 'sealed', serveMl: null, price, isDefault: true, happyHour: happy }],
});

const spirit = (key: string, name: string, sku: string, photo: keyof typeof PHOTO, tot: number, bottle: number, cost: number, doublePhoto?: keyof typeof PHOTO): SeedProductSpec => ({
  key,
  name,
  brand: name,
  category: 'spirits',
  sku,
  photo,
  containerMl: 750,
  abv: 40,
  supplier: 'kariuki',
  threshold: 2,
  reorderPoint: 6,
  reorderQty: 12,
  unitCost: cost,
  variants: [
    { key: 'tot', name: `${name} tot`, kind: 'serve', serveMl: 30, price: tot, isDefault: true },
    { key: 'double', name: `${name} double`, kind: 'serve', serveMl: 60, price: tot * 2, isDefault: false, photo: doublePhoto },
    { key: 'bottle', name: `${name} 750ml`, kind: 'sealed', serveMl: null, price: bottle, isDefault: false },
  ],
});

const soft = (key: string, name: string, sku: string, photo: keyof typeof PHOTO, ml: number, price: number, cost: number): SeedProductSpec => ({
  key,
  name,
  brand: name.split(' ')[0] ?? null,
  category: 'soft',
  sku,
  photo,
  containerMl: ml,
  abv: null,
  supplier: 'coast',
  threshold: 12,
  reorderPoint: 48,
  reorderQty: 120,
  unitCost: cost,
  variants: [{ key: 'unit', name: `${name} ${ml}ml`, kind: 'sealed', serveMl: null, price, isDefault: true }],
});

const plate = (key: string, name: string, sku: string, photo: keyof typeof PHOTO, price: number, cost: number): SeedProductSpec => ({
  key,
  name,
  brand: null,
  category: 'food',
  sku,
  photo,
  containerMl: null,
  abv: null,
  supplier: null,
  threshold: null,
  reorderPoint: 0,
  reorderQty: 0,
  unitCost: cost,
  variants: [{ key: 'plate', name, kind: 'sealed', serveMl: null, price, isDefault: true }],
});

export const PRODUCT_SPECS: SeedProductSpec[] = [
  beer('tusker', 'Tusker', 'BER-TSK-500', 'tusker', 500, 350, 215, 300),
  beer('tusker-lite', 'Tusker Lite', 'BER-TSL-500', 'lite', 500, 380, 232, 330),
  beer('white-cap', 'White Cap', 'BER-WCP-500', 'whitecap', 500, 350, 214, 300),
  beer('balozi', 'Balozi', 'BER-BLZ-500', 'balozi', 500, 330, 198, 290),
  { ...beer('guinness', 'Guinness', 'BER-GNS-500', 'guinness', 500, 400, 248), reorderPoint: 48, reorderQty: 96 },
  beer('heineken', 'Heineken', 'BER-HNK-330', 'heineken', 330, 450, 290),
  beer('pilsner', 'Pilsner', 'BER-PLS-500', 'pilsner', 500, 330, 196, 290),
  beer('summit', 'Summit Lager', 'BER-SMT-500', 'summit', 500, 320, 190),
  spirit('gilbeys', 'Gilbeys', 'SPR-GIL-750', 'gilbeys', 250, 2800, 1480, 'gilbeysDouble'),
  spirit('smirnoff', 'Smirnoff', 'SPR-SMR-750', 'smirnoff', 300, 3200, 1720),
  spirit('kenya-cane', 'Kenya Cane', 'SPR-KCN-750', 'cane', 200, 1600, 860),
  spirit('captain-morgan', 'Captain Morgan', 'SPR-CMG-750', 'morgan', 350, 3000, 1650),
  spirit('jameson', 'Jameson', 'SPR-JAM-750', 'jameson', 600, 4500, 2900),
  spirit('hunters', 'Hunters Choice', 'SPR-HNT-750', 'hunters', 200, 1500, 780),
  // A slow liqueur that has not moved in weeks: the dead stock report is not empty by accident.
  spirit('amarula', 'Amarula', 'SPR-AMR-750', 'morgan', 350, 3400, 1950),
  {
    key: 'four-cousins',
    name: 'Four Cousins',
    brand: 'Four Cousins',
    category: 'wine',
    sku: 'WIN-FRC-750',
    photo: 'cousins',
    containerMl: 750,
    abv: 8,
    supplier: 'kariuki',
    threshold: 2,
    reorderPoint: 6,
    reorderQty: 12,
    unitCost: 1050,
    variants: [
      { key: 'glass', name: 'Four Cousins glass', kind: 'serve', serveMl: 175, price: 600, isDefault: true },
      { key: 'bottle', name: 'Four Cousins 750ml', kind: 'sealed', serveMl: null, price: 2200, isDefault: false },
    ],
  },
  {
    key: 'nederburg',
    name: 'Nederburg',
    brand: 'Nederburg',
    category: 'wine',
    sku: 'WIN-NDB-750',
    photo: 'nederburg',
    containerMl: 750,
    abv: 13.5,
    supplier: 'kariuki',
    threshold: 2,
    reorderPoint: 4,
    reorderQty: 6,
    unitCost: 1380,
    variants: [
      { key: 'glass', name: 'Nederburg glass', kind: 'serve', serveMl: 175, price: 650, isDefault: true },
      { key: 'bottle', name: 'Nederburg 750ml', kind: 'sealed', serveMl: null, price: 2600, isDefault: false },
    ],
  },
  {
    key: 'drostdy-hof',
    name: 'Drostdy Hof',
    brand: 'Drostdy Hof',
    category: 'wine',
    sku: 'WIN-DRH-750',
    photo: 'drostdy',
    containerMl: 750,
    abv: 12.5,
    supplier: 'kariuki',
    threshold: 2,
    reorderPoint: 4,
    reorderQty: 6,
    unitCost: 720,
    variants: [{ key: 'bottle', name: 'Drostdy Hof 750ml', kind: 'sealed', serveMl: null, price: 1400, isDefault: true }],
  },
  soft('coke', 'Coke', 'SFT-COK-300', 'coke', 300, 120, 58),
  soft('fanta', 'Fanta Orange', 'SFT-FNT-300', 'fanta', 300, 120, 58),
  soft('sprite', 'Sprite', 'SFT-SPR-300', 'sprite', 300, 120, 58),
  soft('dasani', 'Dasani', 'SFT-DSN-500', 'dasani', 500, 100, 42),
  soft('tonic', 'Schweppes Tonic', 'SFT-TNC-300', 'tonic', 300, 150, 76),
  soft('red-bull', 'Red Bull', 'SFT-RDB-250', 'redbull', 250, 350, 205),
  plate('nyama-choma', 'Nyama choma plate', 'FOD-NYM-001', 'nyama', 900, 420),
  plate('mishkaki', 'Mishkaki', 'FOD-MSK-001', 'mishkaki', 450, 190),
  plate('kachumbari', 'Kachumbari', 'FOD-KCH-001', 'kachumbari', 150, 45),
  plate('tilapia', 'Grilled tilapia', 'FOD-TLP-001', 'tilapia', 1100, 560),
];

export const productIdFor = (key: string) => seedId(`product:${key}`);
export const variantIdFor = (productKey: string, variantKey: string) => seedId(`variant:${productKey}:${variantKey}`);

export const PRODUCTS: Product[] = PRODUCT_SPECS.map((p) => ({
  id: productIdFor(p.key),
  outletId,
  categoryId: seedId(`category:${p.category}`),
  name: p.name,
  brand: p.brand,
  sku: p.sku,
  barcode: null,
  containerVolumeMl: p.containerMl,
  abv: p.abv,
  isSoldSealed: p.variants.some((v) => v.kind === 'sealed'),
  isSoldByServe: p.variants.some((v) => v.kind === 'serve'),
  lowStockThreshold: p.threshold,
  reorderPoint: p.reorderPoint,
  reorderQty: p.reorderQty,
  leadTimeDays: p.supplier === 'kariuki' ? 3 : p.supplier === 'rift' ? 2 : 1,
  defaultSupplierId: p.supplier ? supplierByKey(p.supplier).id : null,
  imageKey: PHOTO[p.photo],
  status: 'active',
}));

/** Per variant photo override: a double may carry its own photograph. */
export const VARIANT_IMAGE = new Map<string, string>();

export const VARIANTS: ProductVariant[] = PRODUCT_SPECS.flatMap((p) =>
  p.variants.map((v, i) => {
    const id = variantIdFor(p.key, v.key);
    if (v.photo) VARIANT_IMAGE.set(id, PHOTO[v.photo]);
    return {
      id,
      outletId,
      productId: productIdFor(p.key),
      name: v.name,
      kind: v.kind,
      serveVolumeMl: v.serveMl,
      depletionFactor: v.kind === 'serve' && v.serveMl && p.containerMl ? Math.round((v.serveMl / p.containerMl) * 10_000) / 10_000 : 1,
      barcode: null,
      isDefault: v.isDefault,
      sortOrder: i,
      status: 'active' as const,
    };
  }),
);

/**
 * A recipe serve. Smirnoff and Coke depletes a Smirnoff tot and a Coke: two movements from one line,
 * and nothing for the ice. docs/05-flows-and-channels.md section 2.4.
 */
export const RECIPE_PRODUCT: Product = {
  id: productIdFor('smirnoff-coke'),
  outletId,
  categoryId: seedId('category:spirits'),
  name: 'Smirnoff and Coke',
  brand: 'Smirnoff',
  sku: 'SPR-SMC-001',
  barcode: null,
  containerVolumeMl: null,
  abv: null,
  isSoldSealed: false,
  isSoldByServe: true,
  lowStockThreshold: null,
  reorderPoint: 0,
  reorderQty: 0,
  leadTimeDays: 0,
  defaultSupplierId: null,
  imageKey: PHOTO.smirnoff,
  status: 'active',
};

export const RECIPE_VARIANT: ProductVariant = {
  id: variantIdFor('smirnoff-coke', 'glass'),
  outletId,
  productId: RECIPE_PRODUCT.id,
  name: 'Smirnoff and Coke',
  kind: 'serve',
  serveVolumeMl: null,
  depletionFactor: 1,
  barcode: null,
  isDefault: true,
  sortOrder: 0,
  status: 'active',
};

export interface RecipeComponent {
  componentVariantId: string;
  /** Stock units of the component per serve. */
  qty: number;
  volumeMl: number | null;
  wastagePct: number;
}

export interface Recipe {
  id: string;
  productVariantId: string;
  name: string;
  components: RecipeComponent[];
}

export const RECIPES: Recipe[] = [
  {
    id: seedId('recipe:smirnoff-coke'),
    productVariantId: RECIPE_VARIANT.id,
    name: 'Smirnoff and Coke',
    components: [
      { componentVariantId: variantIdFor('smirnoff', 'bottle'), qty: 0.04, volumeMl: 30, wastagePct: 0 },
      { componentVariantId: variantIdFor('coke', 'unit'), qty: 1, volumeMl: 300, wastagePct: 0 },
    ],
  },
];

export const ALL_PRODUCTS: Product[] = [...PRODUCTS, RECIPE_PRODUCT];
export const ALL_VARIANTS: ProductVariant[] = [...VARIANTS, RECIPE_VARIANT];

/**
 * The stock-keeping variant a sellable variant depletes. A serve depletes its product's sealed
 * variant by its depletion factor; a sealed variant depletes itself by one.
 */
export const STOCK_VARIANT = new Map<string, { stockVariantId: string; factor: number }>();
for (const v of VARIANTS) {
  if (v.kind === 'sealed') STOCK_VARIANT.set(v.id, { stockVariantId: v.id, factor: 1 });
}
for (const v of VARIANTS) {
  if (v.kind !== 'serve') continue;
  const sealed = VARIANTS.find((s) => s.productId === v.productId && s.kind === 'sealed');
  if (sealed) STOCK_VARIANT.set(v.id, { stockVariantId: sealed.id, factor: v.depletionFactor });
}

export const MODIFIER_GROUPS: ModifierGroup[] = [
  { id: seedId('modgroup:mixer'), outletId, name: 'Mixer', minSelect: 0, maxSelect: 1, isRequired: false, sortOrder: 1, status: 'active' },
  { id: seedId('modgroup:ice'), outletId, name: 'Ice', minSelect: 0, maxSelect: 1, isRequired: false, sortOrder: 2, status: 'active' },
  { id: seedId('modgroup:temperature'), outletId, name: 'Temperature', minSelect: 0, maxSelect: 1, isRequired: false, sortOrder: 3, status: 'active' },
];

const modifier = (group: string, key: string, name: string, delta: number, linked: string | null, sortOrder: number): Modifier => ({
  id: seedId(`modifier:${group}:${key}`),
  modifierGroupId: seedId(`modgroup:${group}`),
  name,
  priceDeltaCents: shillings(delta),
  linkedVariantId: linked,
  sortOrder,
  status: 'active',
});

export const MODIFIERS: Modifier[] = [
  modifier('mixer', 'coke', 'Coke', 120, variantIdFor('coke', 'unit'), 1),
  modifier('mixer', 'sprite', 'Sprite', 120, variantIdFor('sprite', 'unit'), 2),
  modifier('mixer', 'tonic', 'Tonic', 150, variantIdFor('tonic', 'unit'), 3),
  modifier('mixer', 'soda', 'Soda water', 100, null, 4),
  modifier('ice', 'normal', 'Ice', 0, null, 1),
  modifier('ice', 'none', 'No ice', 0, null, 2),
  modifier('temperature', 'cold', 'Cold', 0, null, 1),
  modifier('temperature', 'warm', 'Warm', 0, null, 2),
];

export const VARIANT_MODIFIER_GROUPS: VariantModifierGroup[] = VARIANTS.flatMap((v) => {
  const product = PRODUCTS.find((p) => p.id === v.productId)!;
  const cat = product.categoryId;
  if (cat === seedId('category:spirits') && v.kind === 'serve') {
    return [
      { productVariantId: v.id, modifierGroupId: seedId('modgroup:mixer'), sortOrder: 1 },
      { productVariantId: v.id, modifierGroupId: seedId('modgroup:ice'), sortOrder: 2 },
    ];
  }
  if (cat === seedId('category:beer')) return [{ productVariantId: v.id, modifierGroupId: seedId('modgroup:temperature'), sortOrder: 1 }];
  if (cat === seedId('category:soft')) return [{ productVariantId: v.id, modifierGroupId: seedId('modgroup:ice'), sortOrder: 1 }];
  return [];
}).concat([{ productVariantId: RECIPE_VARIANT.id, modifierGroupId: seedId('modgroup:ice'), sortOrder: 1 }]);

export const PRICE_LISTS: PriceList[] = [
  { id: seedId('pricelist:standard'), outletId, name: 'Standard', kind: 'base', priority: 0, effectiveFrom: null, effectiveTo: null, status: 'active' },
  { id: seedId('pricelist:happy-hour'), outletId, name: 'Happy hour', kind: 'overlay', priority: 10, effectiveFrom: null, effectiveTo: null, status: 'active' },
  { id: seedId('pricelist:staff'), outletId, name: 'Staff', kind: 'overlay', priority: 5, effectiveFrom: null, effectiveTo: null, status: 'active' },
];

const item = (list: string, variantId: string, price: number, minQty: number | null = null): PriceListItem => ({
  id: seedId(`priceitem:${list}:${variantId}:${minQty ?? 0}`),
  priceListId: seedId(`pricelist:${list}`),
  productVariantId: variantId,
  priceCents: shillings(price),
  minQty,
  status: 'active',
});

export const PRICE_LIST_ITEMS: PriceListItem[] = [
  ...PRODUCT_SPECS.flatMap((p) =>
    p.variants.flatMap((v) => {
      const id = variantIdFor(p.key, v.key);
      // Doubles are derived from the tot through the serve size, so only tots carry a price.
      if (v.key === 'double') return [];
      const rows = [item('standard', id, v.price)];
      if (v.happyHour) rows.push(item('happy-hour', id, v.happyHour));
      if (p.category === 'beer') rows.push(item('standard', id, v.price - 20, 24));
      return rows;
    }),
  ),
  item('standard', RECIPE_VARIANT.id, 650),
];

export const PRICE_RULES: PriceRule[] = [
  {
    id: seedId('rule:happy-hour'),
    outletId,
    name: 'Happy hour',
    priceListId: seedId('pricelist:happy-hour'),
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '17:00',
    endTime: '19:00',
    crossesMidnight: false,
    appliesTo: 'category',
    targetIds: [seedId('category:beer')],
    priority: 10,
    effectiveFrom: null,
    effectiveTo: null,
    status: 'active',
  },
];

export const UNIT_COST = new Map<string, Cents>(
  PRODUCT_SPECS.flatMap((p) => {
    const stock = p.variants.find((v) => v.kind === 'sealed');
    return stock ? [[variantIdFor(p.key, stock.key), shillings(p.unitCost)] as [string, Cents]] : [];
  }),
);

export function imageUrl(key: string | null, width = 320, height = 176): string | null {
  if (!key) return null;
  return `https://images.unsplash.com/photo-${key}?auto=format&fit=crop&w=${width}&h=${height}&q=70`;
}
