import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  { files: ['src/**/*.{ts}', 'tests/**/*.{ts}'] },
  {
    files: ['src/**/*.{ts}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['graphql/*'],
              message:
                'Do not use deep imports from "graphql/*" (can cause multiple realms at runtime when bundled). Import from "graphql" instead.',
            },
          ],
        },
      ],
    },
  },
])
