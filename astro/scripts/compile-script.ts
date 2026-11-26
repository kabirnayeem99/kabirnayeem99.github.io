// Compiles a browser script that is delivered as text (the inline <head> scripts and the
// service worker) to a self-contained classic script. Used by the Vite plugin below, which
// serves `import code from "./file.ts?es5-script"`, and by the unit tests.
import { buildSync } from "esbuild";
import type { ViteUserConfig } from "astro";

type VitePlugin = Extract<NonNullable<ViteUserConfig["plugins"]>[number], { name: string }>;

/**
 * What each import suffix compiles to. These are the newest syntax each script may use:
 * esbuild refuses what it cannot lower (const, let and classes cannot become ES5).
 */
const TARGETS = {
  /** Inline <head> scripts, which have always run in any browser. Minified. */
  "es5-script": { target: "es5", minify: true },
  /** The service worker: async functions. Left readable. */
  "worker-script": { target: "es2017", minify: false },
} as const;

export type ScriptKind = keyof typeof TARGETS;

export function compileScript(file: string, kind: ScriptKind): string {
  const result = buildSync({
    entryPoints: [file],
    bundle: true,
    format: "iife",
    platform: "browser",
    charset: "utf8",
    legalComments: "none",
    // The project's tsconfig is for type checking; it must not change the output.
    tsconfigRaw: {},
    logLevel: "silent",
    write: false,
    ...TARGETS[kind],
  });
  const [output] = result.outputFiles;
  if (output === undefined) {
    throw new Error(`esbuild wrote nothing for ${file}`);
  }
  return output.text.trim();
}

function isScriptKind(value: string): value is ScriptKind {
  return Object.hasOwn(TARGETS, value);
}

export function scriptTextPlugin(): VitePlugin {
  return {
    name: "script-text",
    enforce: "pre",
    load(id) {
      const [file, query] = id.split("?");
      if (file === undefined || query === undefined || !isScriptKind(query)) {
        return null;
      }
      // Rebuilds in `astro dev` when the source changes.
      this.addWatchFile(file);
      return `export default ${JSON.stringify(compileScript(file, query))};`;
    },
  };
}
