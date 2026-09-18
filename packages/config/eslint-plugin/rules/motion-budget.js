import { GLOBAL_CEILING_MS, MOTION_CEILING_MS, findProperty, numericValue, surfaceForFile } from '../utils.js';

/**
 * Duration literals may not exceed the surface ceiling.
 * docs/07-motion-and-interaction.md section 2: Floor 140, Bar 160, Counter 240, Console 400.
 *
 * Checks:
 *  - `duration: <seconds>` on any object literal (GSAP convention)
 *  - `ms: <milliseconds>` on a registry entry, budgeted by its own `surface` literal
 *  - `durationMs: <milliseconds>`
 */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the per-surface motion budget on duration literals' },
    schema: [],
    messages: {
      over: '{{ms}}ms exceeds the {{surface}} ceiling of {{ceiling}}ms.',
    },
  },
  create(context) {
    const fileSurface = surfaceForFile(context.filename);

    function ceilingFor(objectNode) {
      const surfaceProp = findProperty(objectNode, 'surface');
      if (surfaceProp && surfaceProp.value.type === 'Literal' && typeof surfaceProp.value.value === 'string') {
        const s = surfaceProp.value.value;
        if (s in MOTION_CEILING_MS) return { surface: s, ceiling: MOTION_CEILING_MS[s] };
      }
      if (fileSurface) return { surface: fileSurface, ceiling: MOTION_CEILING_MS[fileSurface] };
      return { surface: 'global', ceiling: GLOBAL_CEILING_MS };
    }

    return {
      ObjectExpression(node) {
        const { surface, ceiling } = ceilingFor(node);
        const seconds = findProperty(node, 'duration');
        if (seconds) {
          const value = numericValue(seconds.value);
          if (value !== null) {
            const ms = Math.round(value * 1000);
            if (ms > ceiling) context.report({ node: seconds, messageId: 'over', data: { ms, surface, ceiling } });
          }
        }
        for (const key of ['ms', 'durationMs']) {
          const prop = findProperty(node, key);
          if (!prop) continue;
          const value = numericValue(prop.value);
          if (value !== null && value > ceiling) {
            context.report({ node: prop, messageId: 'over', data: { ms: value, surface, ceiling } });
          }
        }
      },
    };
  },
};
