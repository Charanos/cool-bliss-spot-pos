import gsapTransformOpacityOnly from './rules/gsap-transform-opacity-only.js';
import maxFontWeight from './rules/max-font-weight.js';
import motionBudget from './rules/motion-budget.js';
import noCentsArithmetic from './rules/no-cents-arithmetic.js';
import noCrossModuleSchema from './rules/no-cross-module-schema.js';
import noEmDashOrEmoji from './rules/no-em-dash-or-emoji.js';
import noRawHex from './rules/no-raw-hex.js';
import onePane from './rules/one-pane.js';

/** The Bliss house rules. Each rule cites the document section it enforces. */
const plugin = {
  meta: { name: 'eslint-plugin-bliss', version: '0.1.0' },
  rules: {
    'gsap-transform-opacity-only': gsapTransformOpacityOnly,
    'max-font-weight': maxFontWeight,
    'motion-budget': motionBudget,
    'no-cents-arithmetic': noCentsArithmetic,
    'no-cross-module-schema': noCrossModuleSchema,
    'no-em-dash-or-emoji': noEmDashOrEmoji,
    'no-raw-hex': noRawHex,
    'one-pane': onePane,
  },
};

export default plugin;
