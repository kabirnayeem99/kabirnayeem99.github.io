"""Use-case: type-check JavaScript files with TypeScript in checkJs mode."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def run(*, root: Path | None = None) -> int:
    """Run JS type checks. Returns a process exit code."""

    project_root = (root or Path(__file__).resolve().parent.parent.parent).resolve()
    commands: tuple[tuple[str, ...], ...] = (
        (
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
            "DOM,ES2022",
            "assets/js/*.js",
        ),
        (
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
            "WebWorker,ES2022",
            "service-worker.js",
        ),
    )

    for command in commands:
        try:
            completed = subprocess.run(
                " ".join(command),
                cwd=project_root,
                shell=True,
                check=False,
            )
        except OSError as error:
            print(f"check_js_types.py: failed to execute {' '.join(command)}: {error}", file=sys.stderr)
            return 127

        if completed.returncode != 0:
            return completed.returncode

    return 0
