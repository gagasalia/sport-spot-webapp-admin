// @ts-check
// Flat-config ESLint setup for the Angular admin app.
// Equivalent to what `ng add @angular-eslint/schematics` generates, plus
// eslint-config-prettier so formatting concerns are left to Prettier.
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    // Only lint hand-written source; build artefacts and config are out of scope.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.angular/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // AGENT_GUIDELINES: constructor DI is forbidden — use inject().
      '@angular-eslint/prefer-inject': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
      prettier,
    ],
    rules: {},
  },
  {
    // Test files legitimately use `any` for spies/mocks and empty no-op
    // callbacks (e.g. observer `error: () => {}`). Relax those rules for specs
    // only — this is scoped to *.spec.ts, not a global disable.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
