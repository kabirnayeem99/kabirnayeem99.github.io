#!/usr/bin/env node
// The repository's one definition of "done": the git hooks, CI, deploy and agents all run
// this, so their lists of checks cannot drift apart. Add new checks here and nowhere else.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli.ts";

const GROUPS = ["app", "python", "shell", "site"] as const;
type Group = (typeof GROUPS)[number];

const HELP = `Usage: npm run verify -- [--app] [--python] [--shell] [--site]

Runs the repository's checks and stops at the first failure. With no flag, runs every group.

  --app     lint, CSS lint, format, type checks, unused code, unit tests
  --python  Ruff, ty and unit tests in ../scripts (needs uv)
  --shell   ShellCheck and shfmt over ../.githooks (needs shellcheck, shfmt)
  --site    build, then smoke, accessibility, visual and size-budget checks (needs
            Playwright's Chromium: npx playwright install chromium)
  -h, --help  show this help

Exit status: 0 passed, 1 a check failed, 2 usage error, 130 interrupted.
`;

const INSTALL_HINTS: Readonly<Partial<Record<string, string>>> = {
  uv: "brew install uv, or https://docs.astral.sh/uv/",
  shellcheck: "brew install shellcheck",
  shfmt: "brew install shfmt",
};

const ASTRO_DIR = fileURLToPath(new URL("..", import.meta.url));
const SCRIPTS_DIR = fileURLToPath(new URL("../../scripts", import.meta.url));
const REPO_DIR = fileURLToPath(new URL("../..", import.meta.url));

interface Check {
  readonly name: string;
  readonly dir: string;
  readonly command: string;
  readonly args: readonly string[];
}

const npm = (script: string): Check => ({
  name: script,
  dir: ASTRO_DIR,
  command: "npm",
  args: ["run", "--silent", script],
});

const python = (name: string, ...args: readonly string[]): Check => ({
  name,
  dir: SCRIPTS_DIR,
  command: "uv",
  args: ["run", "--locked", ...args],
});

function shellFiles(): string[] {
  return readdirSync(new URL("../../.githooks", import.meta.url))
    .filter((file) => !file.endsWith(".md"))
    .map((file) => `.githooks/${file}`);
}

function checksFor(group: Group): readonly Check[] {
  switch (group) {
    case "app":
      return ["lint", "lint:css", "css:build", "format:check", "check", "knip", "test"].map(npm);
    case "python":
      return [
        python("ruff format", "ruff", "format", "--check"),
        python("ruff check", "ruff", "check"),
        python("ty check", "ty", "check"),
        python("python tests", "python", "-m", "unittest", "discover", "-s", "tests"),
      ];
    case "shell":
      return [
        { name: "shellcheck", dir: REPO_DIR, command: "shellcheck", args: shellFiles() },
        { name: "shfmt", dir: REPO_DIR, command: "shfmt", args: ["--diff", ...shellFiles()] },
      ];
    case "site":
      return ["build", "test:smoke", "test:a11y", "test:visual", "test:budgets"].map(npm);
  }
}

/** Runs one check, its output on stderr. Resolves to the exit status verify should end with. */
async function run(check: Check): Promise<number> {
  process.stderr.write(`verify: ${check.name}\n`);
  const child = spawn(check.command, check.args, { cwd: check.dir, stdio: ["ignore", 2, 2] });
  return new Promise((resolve) => {
    child.on("error", (error) => {
      const hint = INSTALL_HINTS[check.command];
      const install = hint === undefined ? "" : ` (install: ${hint})`;
      process.stderr.write(`verify: cannot run ${check.command}: ${error.message}${install}\n`);
      resolve(1);
    });
    child.on("close", (status, signal) => {
      if (signal !== null) {
        resolve(130);
        return;
      }
      if (status !== 0) {
        process.stderr.write(`verify: ${check.name} failed\n`);
      }
      resolve(status === 0 ? 0 : 1);
    });
  });
}

await runCli({ name: "verify.ts", help: HELP, flags: GROUPS }, async ({ flags }) => {
  const groups = GROUPS.filter((group) => flags.size === 0 || flags.has(group));
  for (const check of groups.flatMap(checksFor)) {
    const status = await run(check);
    if (status !== 0) {
      return status;
    }
  }
  process.stderr.write(`verify: ${groups.join(", ")} passed\n`);
  return 0;
});
