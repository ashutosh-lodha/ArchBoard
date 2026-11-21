// Shared flat config for the whole monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/generated/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      'packages/icons/vendor/**',
      'packages/icons/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Our Radix-based Switch/Checkbox render buttons that a wrapping <label> does label.
      'jsx-a11y/label-has-associated-control': [
        'error',
        {
          controlComponents: ['Switch', 'Checkbox', 'Input', 'Textarea'],
          assert: 'either',
          depth: 3,
        },
      ],
    },
  },
  {
    files: ['**/scripts/**', '**/*.test.ts', '**/seed.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
