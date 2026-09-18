import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import bliss from './packages/config/eslint-plugin/index.js';

const FLOOR_FILES = ['app/(floor)/**/*.{ts,tsx}', 'packages/ui/src/components/floor/**/*.{ts,tsx}', 'packages/ui/src/motion/floor.ts'];

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'Bliss Floor UI Design/**',
      'docs/**',
      'next-env.d.ts',
      '**/*.tmp.*',
      'packages/config/eslint-plugin/**',
    ],
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      bliss,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Conventions. `any` needs a disable comment that says why.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],

      // docs/06, 07, 08 and 09 Phase 0, item 8.
      'bliss/no-raw-hex': 'error',
      'bliss/max-font-weight': 'error',
      'bliss/no-em-dash-or-emoji': 'error',
      'bliss/gsap-transform-opacity-only': 'error',
      'bliss/motion-budget': 'error',
      'bliss/no-cross-module-schema': 'error',
      'bliss/no-cents-arithmetic': 'error',
      'bliss/one-pane': 'error',

      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lucide-react', message: 'Tabler icons only.' },
            { name: 'react-icons', message: 'Tabler icons only.' },
          ],
          patterns: [{ group: ['@heroicons/*', '@radix-ui/react-icons'], message: 'Tabler icons only.' }],
        },
      ],
    },
  },
  {
    // ADR-014 and docs/07 section 8: Lenis and ScrollTrigger never reach a touch surface.
    files: FLOOR_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'lenis', message: 'Lenis is Console only. ADR-014.' },
            { name: 'gsap/ScrollTrigger', message: 'ScrollTrigger is Console only.' },
            { name: '@bliss/ui/motion/console', message: 'Console motion is not loaded on the Floor.' },
            { name: '@bliss/ui/motion/lenis', message: 'Lenis is Console only. ADR-014.' },
            { name: 'lucide-react', message: 'Tabler icons only.' },
          ],
          patterns: [{ group: ['@bliss/ui/components/console/*'], message: 'Console components are not loaded on the Floor.' }],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'scripts/**', 'packages/db/seed/**'],
    rules: {
      'bliss/no-cents-arithmetic': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
