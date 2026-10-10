

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'shared/python/**',
      'services/python/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
  files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
languageOptions: {
  globals: globals.node,
},
rules: {
  'no-undef': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  'no-unused-vars': 'warn',
  '@typescript-eslint/no-unused-vars': 'off',
},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);