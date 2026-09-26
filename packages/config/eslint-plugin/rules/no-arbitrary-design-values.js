import { normalisePath } from '../utils.js';

/**
 * No arbitrary design values in the Console. docs/19-console-system.md section 2.
 *
 * Type, colour, radius, shadow, space and motion come from tokens, so a value typed in brackets is
 * a style the system does not know about: it drifts, it does not follow the theme, and it is how the
 * revamp ended up with twenty font sizes. Layout templates are different: a grid track list, a
 * width or a height describes one layout, not the system, and stays allowed.
 *
 * Also refused: opacity on text colour (`text-ink-subtle/60`). Text hierarchy is the three ink roles;
 * a faded ink drops below its contrast floor without anyone measuring it.
 */
const PROPERTY =
  '(?:text|shadow|rounded(?:-[trbl]{1,2}|-[se][se]?)?|tracking|leading|font|blur|backdrop-blur|duration|ease|delay|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy]|opacity|bg|border(?:-[trblxy])?|ring|ring-offset|outline|outline-offset|z|fill|stroke|decoration|underline-offset)';
const ARBITRARY = new RegExp(`(?:^|[\\s:!])(-?${PROPERTY}-\\[[^\\]]+\\])`, 'g');
const TEXT_OPACITY = /(?:^|[\s:!])(text-ink(?:-muted|-subtle|-disabled)?\/\d+)/g;

function check(context, node, value) {
  if (typeof value !== 'string' || value.length > 4000) return;
  for (const re of [ARBITRARY, TEXT_OPACITY]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(value))) {
      const token = match[1];
      context.report({ node, messageId: re === ARBITRARY ? 'arbitrary' : 'opacity', data: { token } });
    }
  }
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Refuse arbitrary design values and faded ink in Console class strings' },
    schema: [],
    messages: {
      arbitrary: '{{token}} is an arbitrary design value. Use a token (type, colour, radius, shadow, space or motion); see docs/19.',
      opacity: '{{token}} fades a text colour. Use ink, ink-muted or ink-subtle instead.',
    },
  },
  create(context) {
    const file = normalisePath(context.filename ?? context.getFilename());
    if (/\.test\.[tj]sx?$/.test(file)) return {};
    return {
      Literal(node) {
        check(context, node, node.value);
      },
      TemplateElement(node) {
        check(context, node, node.value.cooked);
      },
    };
  },
};
