#!/usr/bin/env node
// Bundles src/styles/index.css and its imports into public/assets/css/styles.css, which is
// generated and not tracked. Usage: `scripts/css.ts --help`.
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { build, context, type BuildContext, type BuildOptions } from "esbuild";
import { onStopSignal, runCli, UsageError, type CommandLine } from "./cli.ts";

const HELP = `usage: css.ts [-h] [--watch | --dev [-- ASTRO_ARG ...]]

Bundle src/styles/index.css and its imports into public/assets/css/styles.css
(generated, not tracked). With no flag, build once.

options:
  -h, --help  show this help message and exit
  --watch     build, then rebuild on every change until interrupted
  --dev       watch, with \`astro dev\` running beside it
  --          with --dev: hand the remaining arguments to \`astro dev\`

npm: css:build, css:watch, dev (\`npm run dev -- --port 4000\`)

exit status: 0 done, 1 failed, 2 usage error, 130 interrupted.
`;

const APP_DIR = fileURLToPath(new URL("../", import.meta.url));
const ASTRO_BIN = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));
const OPTIONS: BuildOptions = {
  absWorkingDir: APP_DIR,
  entryPoints: ["src/styles/index.css"],
  outfile: "public/assets/css/styles.css",
  bundle: true,
  minify: true,
  // url() paths are written relative to the output file: copy them through untouched.
  external: ["*.woff2", "*.svg"],
  logLevel: "warning",
};

async function buildOnce(): Promise<number> {
  onStopSignal((_signal, exitCode) => {
    process.exit(exitCode);
  });
  try {
    await build(OPTIONS);
    return 0;
  } catch {
    // esbuild has already printed the errors; only the exit status is left to report.
    return 1;
  }
}

async function startWatching(logLevel: "info" | "warning"): Promise<BuildContext> {
  const watcher = await context({ ...OPTIONS, logLevel });
  // The first build finishes before the dev server can be asked for the file. A broken
  // stylesheet is reported and then watched until it is fixed.
  await watcher.rebuild().catch(() => undefined);
  await watcher.watch();
  return watcher;
}

/** Resolves with the exit status once a signal ends the watch. */
async function watchUntilStopped(): Promise<number> {
  const stopped = new Promise<number>((resolve) => {
    onStopSignal((_signal, exitCode) => {
      resolve(exitCode);
    });
  });
  const watcher = await startWatching("info");
  const exitCode = await stopped;
  await watcher.dispose();
  return exitCode;
}

/** Resolves with the exit status once `astro dev` ends, by itself or by a signal passed on. */
async function serve(astroArgs: readonly string[]): Promise<number> {
  let server: ChildProcess | undefined;
  let stoppedWith: number | undefined;
  onStopSignal((signal, exitCode) => {
    stoppedWith = exitCode;
    if (server === undefined) {
      process.exit(exitCode);
    }
    server.kill(signal);
  });
  const watcher = await startWatching("warning");
  try {
    // Under an AI agent Astro would move to the background and return, ending the CSS watch
    // with it. Any value but "1" keeps it in the foreground; `--background` still works.
    server = spawn(process.execPath, [ASTRO_BIN, "dev", ...astroArgs], {
      cwd: APP_DIR,
      env: { ...process.env, ASTRO_DEV_BACKGROUND: process.env["ASTRO_DEV_BACKGROUND"] ?? "0" },
      stdio: "inherit",
    });
    // Rejects if the server cannot be started.
    const exit: unknown[] = await once(server, "exit");
    return stoppedWith ?? (exit[0] === 0 ? 0 : 1);
  } finally {
    await watcher.dispose();
  }
}

async function main({ flags, rest }: CommandLine<"watch" | "dev">): Promise<number> {
  if (flags.has("watch") && flags.has("dev")) {
    throw new UsageError("--watch and --dev cannot be used together");
  }
  if (flags.has("dev")) {
    return serve(rest);
  }
  if (rest.length > 0) {
    throw new UsageError("arguments after -- are only accepted with --dev");
  }
  return flags.has("watch") ? watchUntilStopped() : buildOnce();
}

await runCli({ name: "css.ts", help: HELP, flags: ["watch", "dev"], takesRest: true }, main);
