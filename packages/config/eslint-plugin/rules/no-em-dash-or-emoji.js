const EM_DASH = /—/;
const EMOJI = /\p{Extended_Pictographic}/u;
const EXCLAMATION = /[A-Za-z0-9)]\!(\s|$)/;

/**
 * House copy rules from docs/08-ux-copy.md: no em dashes, no emoji, no exclamation marks
 * in any user-facing string. Applied to string literals and JSX text.
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow em dashes, emoji and exclamation marks in strings' },
    schema: [],
    messages: {
      emDash: 'Em dash in a string. Use a comma, a full stop or a middle dot instead.',
      emoji: 'Emoji in a string. Bliss copy carries no emoji.',
      exclamation: 'Exclamation mark in a string. Bliss copy is calm, never excited.',
    },
  },
  create(context) {
    function check(node, text, { copyOnly }) {
      if (typeof text !== 'string' || text.length === 0) return;
      if (EM_DASH.test(text)) context.report({ node, messageId: 'emDash' });
      if (EMOJI.test(text)) context.report({ node, messageId: 'emoji' });
      if (copyOnly && EXCLAMATION.test(text)) context.report({ node, messageId: 'exclamation' });
    }

    return {
      Literal(node) {
        // Import paths, directives and regular expressions are code, not copy.
        if (node.parent?.type === 'ImportDeclaration' || node.parent?.type === 'ExportNamedDeclaration') return;
        if (node.regex) return;
        const looksLikeCopy = typeof node.value === 'string' && /\s/.test(node.value) && /[A-Za-z]/.test(node.value);
        check(node, node.value, { copyOnly: looksLikeCopy });
      },
      TemplateElement(node) {
        check(node, node.value.cooked, { copyOnly: true });
      },
      JSXText(node) {
        check(node, node.value, { copyOnly: true });
      },
    };
  },
};
