module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    // Hooks live next to their providers throughout this app, so the
    // "component-only exports" fast-refresh rule is not useful here.
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
  },
};
