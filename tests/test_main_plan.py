from __future__ import annotations

import argparse
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import main as app_main  # noqa: E402


class MainPlanPureTests(unittest.TestCase):
    def test_missing_operation_error(self) -> None:
        args = argparse.Namespace(
            render_site=False,
            validate_links=False,
            check_js_types=False,
        )
        self.assertIsNotNone(app_main.missing_operation_error(args))

    def test_build_execution_plan(self) -> None:
        args = argparse.Namespace(
            render_site=True,
            validate_links=True,
            check_js_types=False,
            content="content/site-content.json",
            root=".",
            check=True,
            page=["index"],
            lang=["en"],
            verbose=False,
        )
        plan = app_main.build_execution_plan(args)
        self.assertTrue(plan.run_render_site)
        self.assertTrue(plan.run_validate_links)
        self.assertFalse(plan.run_check_js_types)
        self.assertIsInstance(plan.root, Path)
        self.assertEqual(
            plan.render_args,
            ("--root", ".", "--content", "content/site-content.json", "--check", "--page", "index", "--lang", "en"),
        )


if __name__ == "__main__":
    unittest.main()
