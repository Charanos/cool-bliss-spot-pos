import { normalisePath } from '../utils.js';

/**
 * A module never imports another module's schema file.
 * docs/02-system-architecture.md section 4: cross-module access goes through a module's service.
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: "Disallow importing another module's schema file" },
    schema: [],
    messages: {
      cross: 'Module "{{from}}" imports the schema of module "{{to}}". Call the {{to}} service instead.',
    },
  },
  create(context) {
    const path = normalisePath(context.filename);
    const own = path.match(/\/modules\/([a-z-]+)\//)?.[1] ?? null;

    function check(node, source) {
      if (typeof source !== 'string') return;
      // Absolute (@/modules/x/schema) and relative (../x/schema) imports both name the module.
      const target = source.match(/(?:^|\/)([a-z_-]+)\/schema(?:\.[jt]s)?$/)?.[1];
      if (!target) return;
      if (own === target) return;
      context.report({ node, messageId: 'cross', data: { from: own ?? 'app', to: target } });
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(node, node.source.value);
      },
    };
  },
};
