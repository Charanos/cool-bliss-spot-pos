const FORBIDDEN = new Set([
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'boxShadow',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
]);

const TWEEN_METHODS = new Set(['to', 'from', 'fromTo', 'set']);

function isGsapTween(callee) {
  if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return false;
  if (!TWEEN_METHODS.has(callee.property.name)) return false;
  const obj = callee.object;
  // gsap.to(...), tl.to(...), timeline().to(...)
  if (obj.type === 'Identifier') return /^(gsap|tl|timeline|tween)$/i.test(obj.name) || /Timeline$/.test(obj.name);
  if (obj.type === 'CallExpression') return true;
  return false;
}

/**
 * Only transform and opacity are animated. docs/07-motion-and-interaction.md section 4:
 * "Never animate width, height, top, left, margin, padding or box-shadow."
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Restrict GSAP tweens to transform and opacity' },
    schema: [],
    messages: {
      layout: 'GSAP tween targets "{{prop}}". Animate transform and opacity only, or use Flip for layout.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isGsapTween(node.callee)) return;
        for (const arg of node.arguments) {
          if (arg.type !== 'ObjectExpression') continue;
          for (const prop of arg.properties) {
            if (prop.type !== 'Property') continue;
            const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : '';
            if (FORBIDDEN.has(key)) context.report({ node: prop, messageId: 'layout', data: { prop: key } });
          }
        }
      },
    };
  },
};
