from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from use_cases.validate_links import (  # noqa: E402
    HtmlDocument,
    MissingReference,
    extract_html_references,
    find_missing_references,
    format_missing_reference,
    strip_fragment_and_query,
)


class ValidateLinksPureTests(unittest.TestCase):
    def test_extract_html_references_returns_href_and_src_values(self) -> None:
        html = '<a href="work.html">Work</a><img src="assets/logo.svg" alt="" />'
        self.assertEqual(extract_html_references(html), ("work.html", "assets/logo.svg"))

    def test_strip_fragment_and_query(self) -> None:
        self.assertEqual(strip_fragment_and_query("work.html?x=1#anchor"), "work.html")

    def test_find_missing_references_ignores_external_and_checks_local(self) -> None:
        project_root = Path("/site")
        document = HtmlDocument(
            path=Path("/site/index.html"),
            contents=(
                '<a href="https://example.com">x</a>'
                '<a href="work.html">work</a>'
                '<img src="assets/logo.svg" alt="" />'
            ),
        )

        def fake_exists(path: Path) -> bool:
            return path == Path("/site/work.html")

        findings = find_missing_references(
            document,
            project_root=project_root,
            exists=fake_exists,
        )
        self.assertEqual(
            findings,
            (
                MissingReference(
                    html_file=Path("/site/index.html"),
                    reference="assets/logo.svg",
                ),
            ),
        )

    def test_format_missing_reference(self) -> None:
        finding = MissingReference(html_file=Path("/site/bn/index.html"), reference="missing.css")
        self.assertEqual(
            format_missing_reference(finding, Path("/site")),
            "Missing reference: bn/index.html -> missing.css",
        )


if __name__ == "__main__":
    unittest.main()
