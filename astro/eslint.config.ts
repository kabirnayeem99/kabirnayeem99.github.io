import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import js from "@eslint/js";
import eslintPluginAstro from "eslint-plugin-astro";
import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/** Rules on top of the presets that need no type information. */
const syntaxRules: Linter.RulesRecord = {
  "array-callback-return": ["error", { checkForEach: true }],
  "default-case-last": "error",
  eqeqeq: ["error", "always"],
  "guard-for-in": "error",
  "no-caller": "error",
  "no-constructor-return": "error",
  "no-eval": "error",
  "no-extend-native": "error",
  "no-new-func": "error",
  "no-new-wrappers": "error",
  "no-promise-executor-return": "error",
  "no-proto": "error",
  "no-return-assign": "error",
  "no-script-url": "error",
  "no-self-compare": "error",
  "no-sequences": "error",
  "no-template-curly-in-string": "error",
  "no-unmodified-loop-condition": "error",
  "no-unreachable-loop": "error",
  "require-atomic-updates": "error",
  "@eslint-community/eslint-comments/require-description": ["error", { ignore: ["eslint-enable"] }],
  "@eslint-community/eslint-comments/no-unused-disable": "off", // linterOptions covers this
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      "ts-check": false,
      "ts-expect-error": "allow-with-description",
      "ts-ignore": true,
      "ts-nocheck": true,
      minimumDescriptionLength: 10,
    },
  ],
  "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
  "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
  "@typescript-eslint/explicit-module-boundary-types": "error",
  "@typescript-eslint/method-signature-style": ["error", "property"],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  "no-shadow": "off",
  "@typescript-eslint/no-shadow": "error",
};

/** Rules that need the TypeScript program. */
const typedRules: Linter.RulesRecord = {
  "@typescript-eslint/consistent-type-exports": "error",
  "@typescript-eslint/no-unsafe-type-assertion": "error",
  "@typescript-eslint/prefer-readonly": "error",
  "@typescript-eslint/promise-function-async": "error",
  "@typescript-eslint/require-array-sort-compare": ["error", { ignoreStringArrays: true }],
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
  "@typescript-eslint/strict-boolean-expressions": [
    "error",
    { allowNullableObject: true, allowNumber: false, allowString: false },
  ],
  "@typescript-eslint/strict-void-return": "error",
  "@typescript-eslint/switch-exhaustiveness-check": [
    "error",
    {
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: true,
    },
  ],
};

const typedPresets = [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked];

export default defineConfig(
  // public/ holds only static assets and the generated stylesheet.
  { ignores: ["dist", ".astro", "node_modules", "public"] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  // .astro files: frontmatter and <script> blocks (parsed with typescript-eslint).
  ...eslintPluginAstro.configs.recommended,
  comments.recommended,
  { rules: syntaxRules },
  // Type-aware rules for TypeScript. <script> blocks inside .astro files are linted as virtual
  // files that belong to no TypeScript program, so they get the syntax-only rules above.
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: ["**/*.astro/**"],
    extends: [typedPresets],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { ...syntaxRules, ...typedRules },
  },
  // The same rules for .astro files. Their parser does not support projectService.
  {
    files: ["**/*.astro"],
    extends: [typedPresets.map(({ rules = {} }) => ({ rules }))],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        project: "./tsconfig.json",
        extraFileExtensions: [".astro"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...syntaxRules,
      ...typedRules,
      // False positive: this parser cannot type JSX, so every `.map()` that returns markup
      // is reported as returning an unsafe value.
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  // Inline <head> scripts are compiled to ES5, which esbuild cannot lower these to.
  {
    files: ["src/inline/{theme-bootstrap,page-arrival,umami-loader}.ts"],
    rules: {
      "no-var": "off",
      "@typescript-eslint/prefer-for-of": "off",
    },
  },
  // node:test's test() returns a promise that the runner itself waits for.
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", name: ["test"], package: "node:test" }] },
      ],
    },
  },
);
