import { normalisePath } from '../utils.js';

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const RGB = /\brgba?\(\s*\d/;

/**
 * No raw colour outside the token file. docs/06-design-system.md section 9:
 * "A raw hex in a component is a build failure."
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw hex or rgb colours outside the token source' },
    schema: [],
    messages: {
      raw: 'Raw colour "{{value}}" found. Use a design token from packages/ui/src/tokens instead.',
    },
  },
  create(context) {
    const path = normalisePath(context.filename);
    if (/\/packages\/ui\/src\/tokens\//.test(path)) return {};

    function check(node, text) {
      if (typeof text !== 'string') return;
      const match = text.match(HEX) ?? text.match(RGB);
      if (!match) return;
      // Allow URL fragments such as href="#main".
      if (match[0].startsWith('#') && /^#[a-z]/i.test(text.trim()) && !/^#[0-9a-f]+$/i.test(text.trim())) return;
      context.report({ node, messageId: 'raw', data: { value: match[0] } });
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
};
