// Minimal ESLint flat config. RepoRadar ships zero runtime dependencies; this keeps
// the toolchain optional — run `npx eslint .` (ESLint is fetched on demand) without
// adding it to the dependency tree.
export default [
  {
    files: ['bin/**/*.js', 'src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
];
