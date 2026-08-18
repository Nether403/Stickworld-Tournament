import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import stickworld from './plugin.js';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      'Research/**',
      'Developing a Web-Based Stickman Tournament Platform/**',
      '.kiro/**',
      '**/conformance/page/harness.js',
      '**/.next/**',
      'apps/web/next-env.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['packages/sim-core/src/**/*.ts', '**/simulation/**/*.ts'],
    plugins: { stickworld },
    rules: {
      'stickworld/no-nondeterminism': 'error',
      'stickworld/no-host-imports': 'error',
    },
  },
);
