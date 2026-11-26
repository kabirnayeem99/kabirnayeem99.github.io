// The command-line conventions every script here shares with the Python ones in ../../scripts:
// -h/--help, long --kebab-case flags, diagnostics on stderr (stdout is for help and data), and
// exit status 0 done, 1 failed, 2 usage error, 128+N stopped by signal N (130 for Ctrl-C).
import { constants } from "node:os";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

/** A command line that parses but makes no sense; reported like an unknown flag. */
export class UsageError extends Error {}

export interface Command<Flag extends string> {
  /** The file name, which prefixes every message. */
  readonly name: string;
  /** The whole --help text. */
  readonly help: string;
  /** Long flags without the dashes. None takes a value. */
  readonly flags: readonly Flag[];
  /** Whether arguments after "--" are accepted, to be handed to another program. */
  readonly takesRest?: boolean;
}

export interface CommandLine<Flag extends string> {
  readonly flags: ReadonlySet<Flag>;
  /** What followed "--". */
  readonly rest: readonly string[];
}

/** Calls `stop` on Ctrl-C, termination or hang-up, with the exit status that reports it. */
export function onStopSignal(stop: (signal: NodeJS.Signals, exitCode: number) => void): void {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      stop(signal, 128 + constants.signals[signal]);
    });
  }
}

/** Returns null when help was asked for. Throws on anything the command does not accept. */
function parseCommandLine<Flag extends string>(
  command: Command<Flag>,
  argv: readonly string[],
): CommandLine<Flag> | null {
  const separator = command.takesRest === true ? argv.indexOf("--") : -1;
  const own = separator === -1 ? argv : argv.slice(0, separator);
  const options: ParseArgsOptionsConfig = { help: { type: "boolean", short: "h" } };
  for (const flag of command.flags) {
    options[flag] = { type: "boolean" };
  }
  const { values } = parseArgs({ args: [...own], options, strict: true, allowPositionals: false });
  if (values["help"] === true) {
    return null;
  }
  return {
    flags: new Set(command.flags.filter((flag) => values[flag] === true)),
    rest: separator === -1 ? [] : argv.slice(separator + 1),
  };
}

function isUsageError(error: Error): boolean {
  return error instanceof UsageError || ("code" in error && String(error.code).startsWith("ERR_PARSE_ARGS_"));
}

/** Parses the command line, runs `main` unless help was asked for, and sets the exit status. */
export async function runCli<Flag extends string>(
  command: Command<Flag>,
  main: (commandLine: CommandLine<Flag>) => Promise<number>,
): Promise<void> {
  try {
    const commandLine = parseCommandLine(command, process.argv.slice(2));
    if (commandLine === null) {
      process.stdout.write(command.help);
      return;
    }
    process.exitCode = await main(commandLine);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    const usage = isUsageError(failure);
    process.stderr.write(`${command.name}: ${failure.message}\n`);
    if (usage) {
      process.stderr.write(`Try '${command.name} --help'.\n`);
    }
    process.exitCode = usage ? EXIT_USAGE : EXIT_FAILURE;
  }
}
