import { jsxName, staticStrings } from '../utils.js';

/**
 * Utility classes that give an element a surface of its own, at any opacity. A card's bands
 * (card-band, card-band-strong) tint a strip of the card they sit in; they are not surfaces.
 */
const SURFACE_BG = /(^|\s|:)(bg-(raised|sunken|overlay|card)(\/\d+)?|card-surface)(?=\s|$)/;
/**
 * Full box borders, and rings used as borders. Single-side hairlines (border-t, border-b) are
 * grouping rules, not boxes; a focus ring behind a variant (focus-visible:ring-2) is not a box.
 */
const BOX_BORDER = /(^|\s|:)(border(-[xy])?(-(2|4|8|\[[^\]]+\]))?|card-surface)(?=\s|$)|(^|\s)ring(-[1248])?(?=\s|$)/;

/** Components that render a raised or bordered surface. */
const SURFACE_COMPONENTS = new Set([
  'Pane',
  'Raised',
  'Sheet',
  'Dialog',
  'ReasonDialog',
  'ProductTile',
  'TabCard',
  'MetricCard',
  'Card',
  'Metric',
]);

function classOf(openingElement) {
  const attr = openingElement.attributes.find(
    (a) => a.type === 'JSXAttribute' && a.name?.name === 'className',
  );
  if (!attr) return '';
  return staticStrings(attr.value).join(' ');
}

function describe(openingElement) {
  const name = jsxName(openingElement.name);
  const cls = classOf(openingElement);
  const surface = SURFACE_COMPONENTS.has(name) || SURFACE_BG.test(cls);
  const boxed = BOX_BORDER.test(cls);
  return { name, surface, boxed };
}

/**
 * One level of depth, everywhere. docs/06-design-system.md section 1:
 * "No element with a background may contain another element with a background.
 *  No element with a border may contain another element with a border."
 *
 * The Console's Card family (docs/19) keeps the rule: a card is one surface, and nothing inside it is
 * another. Its header and footer are bands, a tint on a strip of the same card.
 *
 * Static and per file: it follows the JSX tree written in one component. Seat chips, status dots
 * and category edges are marks, not surfaces, so they use their own colour utilities and are exempt.
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the one-pane rule on JSX nesting' },
    schema: [],
    messages: {
      surface: '<{{inner}}> has a surface inside <{{outer}}>, which already has one. One level of depth only.',
      boxed: '<{{inner}}> has a box border inside <{{outer}}>, which already has one. Use space or a single hairline.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const self = describe(node);
        if (!self.surface && !self.boxed) return;
        let parent = node.parent?.parent;
        while (parent) {
          if (parent.type === 'JSXElement') {
            const outer = describe(parent.openingElement);
            if (self.surface && outer.surface) {
              context.report({ node, messageId: 'surface', data: { inner: self.name, outer: outer.name } });
              return;
            }
            if (self.boxed && outer.boxed) {
              context.report({ node, messageId: 'boxed', data: { inner: self.name, outer: outer.name } });
              return;
            }
          }
          if (parent.type === 'ArrowFunctionExpression' || parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression') {
            // A render callback inside JSX (list.map) still belongs to the enclosing tree.
            if (parent.parent?.type !== 'CallExpression') break;
          }
          parent = parent.parent;
        }
      },
    };
  },
};
