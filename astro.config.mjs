import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://kabirnayeem99.github.io",
  integrations: [mdx(), sitemap(), tailwind()],
});
