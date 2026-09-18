import { normalisePath } from '../utils.js';

const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '**']);
const ASSIGN_ARITHMETIC = new Set(['+=', '-=', '*=', '/=', '%=', '**=']);

function isCentsType(checker, type) {
  if (!type) return false;
  if (type.isUnion?.()) return type.types.some((t) => isCentsType(checker, t));
  const brand = checker.getPropertyOfType(type, '__brand');
  if (!brand) return false;
  const brandType = checker.getTypeOfSymbol(brand);
  return brandType.isStringLiteral?.() === true && brandType.value === 'Cents';
}

/**
 * Money is a branded Cents type over bigint. docs/03-adr-register.md ADR-009:
 * "An ESLint rule bans arithmetic between Cents and number."
 *
 * Raw operators on Cents lose the brand and invite float mistakes, so every operator is banned
 * outside the money module. Use add, subtract, multiplyByQty, multiplyByRate and allocate.
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow raw arithmetic on Cents outside the money module', requiresTypeChecking: true },
    schema: [],
    messages: {
      raw: 'Raw "{{op}}" on Cents. Use the helpers in @bliss/shared/money.',
    },
  },
  create(context) {
    const path = normalisePath(context.filename);
    if (/\/packages\/shared\/src\/money\//.test(path)) return {};
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) return {};
    const checker = services.program.getTypeChecker();
    const typeOf = (node) => checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));

    return {
      BinaryExpression(node) {
        if (!ARITHMETIC.has(node.operator)) return;
        if (isCentsType(checker, typeOf(node.left)) || isCentsType(checker, typeOf(node.right))) {
          context.report({ node, messageId: 'raw', data: { op: node.operator } });
        }
      },
      AssignmentExpression(node) {
        if (!ASSIGN_ARITHMETIC.has(node.operator)) return;
        if (isCentsType(checker, typeOf(node.left)) || isCentsType(checker, typeOf(node.right))) {
          context.report({ node, messageId: 'raw', data: { op: node.operator } });
        }
      },
      UpdateExpression(node) {
        if (isCentsType(checker, typeOf(node.argument))) {
          context.report({ node, messageId: 'raw', data: { op: node.operator } });
        }
      },
    };
  },
};
