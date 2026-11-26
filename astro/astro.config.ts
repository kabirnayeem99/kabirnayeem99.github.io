import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";
import { scriptTextPlugin } from "./scripts/compile-script.ts";
import { assertContentValid } from "./src/lib/content-validate.ts";

/** Fails `astro build` on content that does not match src/lib/content-schema.ts. */
const validateContent: AstroIntegration = {
  name: "validate-content",
  hooks: {
    "astro:config:setup": ({ command }) => {
      if (command === "build") {
        assertContentValid(fileURLToPath(new URL(".", import.meta.url)));
      }
    },
  },
};

export default defineConfig({
  output: "static",
  site: "https://kabirnayeem99.github.io",
  base: "/",
  integrations: [validateContent],
  vite: {
    plugins: [scriptTextPlugin()],
  },
  build: {
    format: "file",
  },
});
