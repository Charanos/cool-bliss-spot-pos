/**
 * Shared helpers for the Bliss ESLint rules.
 * Plain ESM so the plugin needs no build step.
 */

/** Normalise a filename to forward slashes for path matching on Windows. */
export function normalisePath(filename) {
  return String(filename).replace(/\\/g, '/');
}

/**
 * Motion ceilings in milliseconds, from docs/07-motion-and-interaction.md section 2.
 * Nothing anywhere exceeds 400ms.
 */
export const MOTION_CEILING_MS = {
  floor: 140,
  bar: 160,
  counter: 240,
  console: 400,
};

export const GLOBAL_CEILING_MS = 400;

/** Resolve the surface a file belongs to, so duration literals can be budgeted. */
export function surfaceForFile(filename) {
  const path = normalisePath(filename);
  if (/\/app\/\(counter\)\/counter\/bar\//.test(path) || /\/motion\/bar[./]/.test(path)) return 'bar';
  if (/\/app\/\(floor\)\//.test(path) || /\/motion\/floor[./]/.test(path) || /\/components\/floor\//.test(path)) {
    return 'floor';
  }
  if (/\/app\/\(counter\)\//.test(path) || /\/motion\/counter[./]/.test(path)) return 'counter';
  if (/\/app\/\(console\)\//.test(path) || /\/motion\/console[./]/.test(path) || /\/components\/console\//.test(path)) {
    return 'console';
  }
  return null;
}

/** Collect the static string fragments of an expression, for className scanning. */
export function staticStrings(node) {
  if (!node) return [];
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : [];
    case 'TemplateLiteral':
      return node.quasis.map((q) => q.value.cooked ?? '');
    case 'JSXExpressionContainer':
      return staticStrings(node.expression);
    case 'ConditionalExpression':
      return [...staticStrings(node.consequent), ...staticStrings(node.alternate)];
    case 'LogicalExpression':
      return [...staticStrings(node.left), ...staticStrings(node.right)];
    case 'CallExpression':
      return node.arguments.flatMap((arg) => staticStrings(arg));
    case 'ArrayExpression':
      return node.elements.flatMap((el) => staticStrings(el));
    case 'ObjectExpression':
      return node.properties.flatMap((p) => (p.type === 'Property' ? staticStrings(p.key) : []));
    default:
      return [];
  }
}

/** The JSX element name as a string, for simple identifiers and member expressions. */
export function jsxName(nameNode) {
  if (!nameNode) return '';
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  if (nameNode.type === 'JSXMemberExpression') return `${jsxName(nameNode.object)}.${jsxName(nameNode.property)}`;
  return '';
}

/** Read a numeric literal, including a negated one. */
export function numericValue(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal') {
    return typeof node.argument.value === 'number' ? -node.argument.value : null;
  }
  return null;
}

/** Find a property by key name on an ObjectExpression. */
export function findProperty(objectNode, keyName) {
  if (!objectNode || objectNode.type !== 'ObjectExpression') return null;
  for (const prop of objectNode.properties) {
    if (prop.type !== 'Property') continue;
    const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : null;
    if (key === keyName) return prop;
  }
  return null;
}
