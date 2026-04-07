from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from use_cases.check_js_types import (  # noqa: E402
    build_tsc_base_args,
    build_typecheck_commands,
    format_command,
)


class CheckJsTypesPureTests(unittest.TestCase):
    def test_build_tsc_base_args(self) -> None:
        args = build_tsc_base_args(lib="DOM,ES2022")
        self.assertEqual(args[0:5], ("npx", "--yes", "-p", "typescript", "tsc"))
        self.assertIn("--checkJs", args)
        self.assertEqual(args[-1], "DOM,ES2022")

    def test_build_typecheck_commands(self) -> None:
        commands = build_typecheck_commands(
            js_files=(Path("assets/js/a.js"), Path("assets/js/b.js")),
            service_worker_file=Path("service-worker.js"),
        )
        self.assertEqual(len(commands), 2)
        self.assertTrue(commands[0].argv[-2:] == ("assets/js/a.js", "assets/js/b.js"))
        self.assertEqual(commands[1].argv[-1], "service-worker.js")

    def test_format_command(self) -> None:
        commands = build_typecheck_commands(
            js_files=(Path("assets/js/a.js"),),
            service_worker_file=Path("service-worker.js"),
        )
        rendered = format_command(commands[0])
        self.assertIn("npx --yes -p typescript tsc", rendered)
        self.assertIn("assets/js/a.js", rendered)


if __name__ == "__main__":
    unittest.main()
