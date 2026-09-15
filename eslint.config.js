import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  // *.tmp.* are throwaway diagnostic scripts run against a local build;
  // they are gitignored and are not part of the site.
  { ignores: ['dist/**', '.astro/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', '**/*.tmp.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['src/scripts/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Empty catch blocks are deliberate in a few places (a seek that
      // isn't ready yet, storage that a private window refuses) — but they
      // have to be spelled out rather than left silently empty.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['tests/**/*.ts', '*.config.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
