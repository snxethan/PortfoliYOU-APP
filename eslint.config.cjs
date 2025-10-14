// Flat config for ESLint v9
// this is a JavaScript file so we can use require() to load configs and plugins
// we use this config instead of .eslintrc.cjs to avoid issues with ESLint not picking up the config in some environments
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const importPlugin = require("eslint-plugin-import");
const globals = require("globals");

module.exports = [
  { ignores: ["dist/**", "out/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react, "react-hooks": reactHooks, import: importPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "import/order": ["warn", { "newlines-between": "always" }],
    },
  },
];

// Note: Prettier config is in .prettierrc and is picked up by eslint-plugin-prettier
// Note: For VSCode, also set "editor.formatOnSave": true and "editor.defaultFormatter": "esbenp.prettier-vscode" in settings.json
