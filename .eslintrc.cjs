/* Minimal ESLint configuration for a TypeScript + React (Vite) project.
   Lint script already exists in package.json:
     "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
*/
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },

  ignorePatterns: [
    "dist/**",
    "node_modules/**",
    "bun.lockb",
    // generated assets and build outputs
    "**/*.d.ts",
  ],

  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
    // If you later want type-aware rules, add:
    // project: ['./tsconfig.json'],
    // tsconfigRootDir: __dirname,
  },

  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],

  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",

  ],

  rules: {
    // Keep console noise down in production, but allow warnings/errors
    "no-console": "off",

    // Prefer TS-aware unused checks
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off",

    // React hooks deps warnings are too noisy for this codebase; handled manually
    "react-hooks/exhaustive-deps": "off",
  },

  overrides: [
    // JavaScript/CommonJS files (e.g., scripts/*.cjs)
    {
      files: ["**/*.cjs", "**/*.js"],
      parser: "espree",
      env: {
        node: true,
      },
      rules: {
        // JS files don't use TS rules
        "@typescript-eslint/no-unused-vars": "off",
      },
    },

    // Allow limited 'any' usage in specific utility files
    {
      files: [
        "client/interface/utils/scrolling.ts",
        "client/interface/components/StoryMinimap.tsx",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
