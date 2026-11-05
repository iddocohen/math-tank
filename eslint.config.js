import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const frameworkImports = [
  { name: 'phaser', message: 'src/core must stay engine-free (FR-028).' },
  { name: 'react', message: 'src/core must stay framework-free (FR-028).' },
  { name: 'react-dom', message: 'src/core must stay framework-free (FR-028).' },
];

const frameworkPatterns = [
  { group: ['phaser/*', 'react/*', 'react-dom/*'], message: 'src/core must stay engine- and framework-free (FR-028).' },
];

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'coverage/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from src/core/rng.ts (FR-028).' },
      ],
      'no-restricted-imports': ['error', { paths: frameworkImports, patterns: frameworkPatterns }],
    },
  },
  {
    files: ['src/core/math/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: frameworkImports,
          patterns: [
            ...frameworkPatterns,
            { group: ['**/core/physics', '**/core/physics/**', '../physics', '../physics/**', '../../physics', '../../physics/**'], message: 'Mathematics must not import game physics.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/physics/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: frameworkImports,
          patterns: [
            ...frameworkPatterns,
            { group: ['**/core/math', '**/core/math/**', '../math', '../math/**', '../../math', '../../math/**'], message: 'Game physics must not import mathematics.' },
          ],
        },
      ],
    },
  },
);
