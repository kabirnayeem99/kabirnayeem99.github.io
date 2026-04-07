from __future__ import annotations

import datetime
import io
import os
import tempfile
import unittest
from pathlib import Path
import sys
from typing import cast

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from site_renderer.constants import (  # noqa: E402
    CSS_OUTPUT_RELATIVE_PATH,
    MANIFEST_OUTPUT_RELATIVE_PATH,
    SERVICE_WORKER_OUTPUT_RELATIVE_PATH,
    SITEMAP_OUTPUT_RELATIVE_PATH,
    Lang,
    PageId,
)
from site_renderer.outputs import render_outputs, source_timestamp, stale_outputs  # noqa: E402
from site_renderer.parsing import load_site_content  # noqa: E402


class OutputsTests(unittest.TestCase):
    def test_source_timestamp_picks_latest_candidate_mtime(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            content_path = root / "content" / "site-content.json"
            css_path = root / "assets" / "css" / "styles.source.css"
            js_path = root / "assets" / "js" / "app.js"
            py_path = root / "src" / "site_renderer" / "module.py"

            for path in (content_path, css_path, js_path, py_path):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("x", encoding="utf-8")

            base = 1_700_000_000
            os.utime(content_path, (base + 1, base + 1))
            os.utime(css_path, (base + 2, base + 2))
            os.utime(js_path, (base + 3, base + 3))
            os.utime(py_path, (base + 4, base + 4))

            timestamp = source_timestamp(root)
            expected = datetime.datetime.fromtimestamp(base + 4, tz=datetime.timezone.utc).astimezone()
            self.assertEqual(int(timestamp.timestamp()), int(expected.timestamp()))

    def test_stale_outputs_detects_changed_and_missing_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "same.txt").write_text("same", encoding="utf-8")
            (root / "changed.txt").write_text("old", encoding="utf-8")

            outputs = {
                "same.txt": "same",
                "changed.txt": "new",
                "missing.txt": "missing",
            }

            stale = stale_outputs(root, outputs)
            self.assertEqual(set(stale), {"changed.txt", "missing.txt"})

    def test_render_outputs_contains_expected_core_keys(self) -> None:
        repo_root = Path(__file__).resolve().parents[1]
        content = load_site_content(
            str(repo_root / "content" / "site-content.json"),
            stdin=io.StringIO(""),
        )

        outputs = render_outputs(
            content,
            root=repo_root,
            page_filter=cast(frozenset[PageId], frozenset({"index"})),
            lang_filter=cast(frozenset[Lang], frozenset({"en"})),
        )

        self.assertIn("index.html", outputs)
        self.assertIn(CSS_OUTPUT_RELATIVE_PATH, outputs)
        self.assertIn(SITEMAP_OUTPUT_RELATIVE_PATH, outputs)
        self.assertIn(MANIFEST_OUTPUT_RELATIVE_PATH, outputs)
        self.assertIn(SERVICE_WORKER_OUTPUT_RELATIVE_PATH, outputs)
        self.assertTrue(outputs["index.html"].startswith("<!DOCTYPE html>"))


if __name__ == "__main__":
    unittest.main()
