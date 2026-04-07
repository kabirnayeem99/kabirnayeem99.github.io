"""Use-case: type-check JavaScript files with TypeScript in checkJs mode."""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from collections.abc import Sequence
from pathlib import Path


@dataclass(frozen=True, slots=True)
class TypecheckCommand:
    """A concrete command invocation for one JS type-check pass."""

    argv: tuple[str, ...]


def build_tsc_base_args(*, lib: str) -> tuple[str, ...]:
    """Build shared TypeScript CLI args for JavaScript type checking."""

    return (
        "npx",
        "--yes",
        "-p",
        "typescript",
        "tsc",
        "--allowJs",
        "--checkJs",
        "--noEmit",
        "--target",
        "ES2022",
        "--lib",
        lib,
    )


def build_typecheck_commands(
    *,
    js_files: Sequence[Path],
    service_worker_file: Path,
) -> tuple[TypecheckCommand, ...]:
    """Build all TypeScript invocations required for this repository."""

    asset_js_argv = (
        *build_tsc_base_args(lib="DOM,ES2022"),
        *(str(path) for path in js_files),
    )
    service_worker_argv = (
        *build_tsc_base_args(lib="WebWorker,ES2022"),
        str(service_worker_file),
    )
    return (
        TypecheckCommand(argv=tuple(asset_js_argv)),
        TypecheckCommand(argv=tuple(service_worker_argv)),
    )


def discover_check_targets(project_root: Path) -> tuple[tuple[Path, ...], Path]:
    """Discover file targets that should be type-checked."""

    js_files = tuple(sorted((project_root / "assets/js").glob("*.js")))
    service_worker_file = project_root / "service-worker.js"
    return (js_files, service_worker_file)


def format_command(command: TypecheckCommand) -> str:
    """Format one command for diagnostics."""

    return " ".join(command.argv)


def run(*, root: Path | None = None) -> int:
    """Run JS type checks. Returns a process exit code."""

    project_root = (root or Path(__file__).resolve().parent.parent.parent).resolve()
    js_files, service_worker_file = discover_check_targets(project_root)
    commands = build_typecheck_commands(
        js_files=js_files,
        service_worker_file=service_worker_file,
    )

    for command in commands:
        try:
            completed = subprocess.run(
                command.argv,
                cwd=project_root,
                check=False,
            )
        except OSError as error:
            print(f"check_js_types.py: failed to execute {format_command(command)}: {error}", file=sys.stderr)
            return 127

        if completed.returncode != 0:
            return completed.returncode

    return 0
