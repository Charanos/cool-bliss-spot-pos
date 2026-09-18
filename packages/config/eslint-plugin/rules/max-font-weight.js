import { findProperty, numericValue } from '../utils.js';

const HEAVY_CLASS = /(^|[\s:"'`])font-(semibold|bold|extrabold|black)(?=[\s"'`]|$)/;
const CSS_WEIGHT = /font-weight\s*:\s*(\d{3})/i;
const ARBITRARY_WEIGHT = /font-\[(\d{3})\]/;

/**
 * Font weight never exceeds 500. docs/06-design-system.md section 3:
 * "There is no bold in this product."
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow any font weight above 500' },
    schema: [],
    messages: {
      heavy: 'Font weight {{value}} is above 500. Hierarchy comes from size, colour and space.',
    },
  },
  create(context) {
    function checkText(node, text) {
      if (typeof text !== 'string') return;
      const cls = text.match(HEAVY_CLASS);
      if (cls) {
        context.report({ node, messageId: 'heavy', data: { value: cls[2] } });
        return;
      }
      const css = text.match(CSS_WEIGHT) ?? text.match(ARBITRARY_WEIGHT);
      if (css && Number(css[1]) > 500) {
        context.report({ node, messageId: 'heavy', data: { value: css[1] } });
      }
    }

    return {
      Literal(node) {
        checkText(node, node.value);
      },
      TemplateElement(node) {
        checkText(node, node.value.cooked);
      },
      ObjectExpression(node) {
        const prop = findProperty(node, 'fontWeight');
        if (!prop) return;
        const num = numericValue(prop.value);
        const str = prop.value.type === 'Literal' && typeof prop.value.value === 'string' ? prop.value.value : null;
        const value = num ?? (str && /^\d+$/.test(str) ? Number(str) : str === 'bold' || str === 'bolder' ? 700 : null);
        if (value !== null && value > 500) {
          context.report({ node: prop, messageId: 'heavy', data: { value: String(value) } });
        }
      },
    };
  },
};
