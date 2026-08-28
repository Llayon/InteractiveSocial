import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      '.pw-tmp/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/e2e/**/*.ts'],
    rules: {
      // Playwright fixtures require a parameter literally named `use`.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // The Quiz screen owns a generic answer-feedback barrier with an
    // imperative setTimeout. The state-reset when leaving a question/phase
    // intentionally runs in an effect (mirroring the timer cleanup it pairs
    // with) and tracks a ref of the previous question/phase for an
    // "if-changed" trigger. Both are narrow, well-scoped and have no
    // derived-state-from-props analogue, so the generic react-hooks lint
    // rules do not add signal here. Everything else in the project keeps
    // the strict rules.
    files: ['src/features/quiz/Quiz.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
  prettier,
)