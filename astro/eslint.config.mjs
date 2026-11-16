import js from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist", ".astro", "node_modules", "public/**/*.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // .astro files: frontmatter and <script> blocks (parsed with typescript-eslint).
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Node-side scripts and tests.
  {
    files: ["**/*.{js,mjs,cjs}", "tests/**/*"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Playwright scripts: Node code plus callbacks that run inside the page.
  {
    files: ["shot*.mjs", "live-check.mjs", "tests/**/*"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
