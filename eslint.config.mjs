import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      semi: ['error', 'never'],
      'no-extra-semi': 'error',
      'object-curly-spacing': ['error', 'always'],
      'no-restricted-properties': [
        'error',
        {
          'object': 'document',
          'property': 'addEventListener',
          'message': 'Avoid using \'addEventListener\' directly on the document object.',
        },
        {
          'object': 'window',
          'property': 'addEventListener',
          'message': 'Avoid using \'addEventListener\' directly on the window object.',
        },
      ],
    },
  },
]
