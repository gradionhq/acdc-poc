import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', 'e2e/test-results/**', 'e2e/playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Flat-config preset for react-hooks (v5): `recommended-latest` is the flat entry.
  {
    files: ['web/**/*.{ts,tsx}'],
    ...reactHooks.configs['recommended-latest'],
    languageOptions: { globals: globals.browser },
  },
  { files: ['server/**/*.ts', 'e2e/**/*.ts'], languageOptions: { globals: globals.node } },
  // Must be LAST: turn off ESLint formatting rules that conflict with Prettier.
  prettier,
);
