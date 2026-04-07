"""Use-case: validate that local href/src references resolve to files."""

from __future__ import annotations

import re
import sys
from pathlib import Path


_ATTR_PATTERN = re.compile(r'(?:href|src)="([^"]+)"')
_HTML_GLOBS: tuple[str, ...] = ("*.html", "ar/*.html", "bn/*.html", "ur/*.html")


def _is_ignorable_reference(value: str) -> bool:
    return (
        value == ""
        or value.startswith("http://")
        or value.startswith("https://")
        or value.startswith("mailto:")
        or value.startswith("#")
        or value.startswith("javascript:")
    )


def run(*, root: Path | None = None) -> int:
    """Validate local references. Returns an exit status code."""

    project_root = (root or Path(__file__).resolve().parent.parent.parent).resolve()
    missing_count = 0

    html_files: list[Path] = []
    for pattern in _HTML_GLOBS:
        html_files.extend(sorted(project_root.glob(pattern)))

    for html_file in html_files:
        contents = html_file.read_text(encoding="utf-8")
        for matched in _ATTR_PATTERN.findall(contents):
            reference = matched.strip()
            reference_path = reference.split("#", 1)[0].split("?", 1)[0]

            if _is_ignorable_reference(reference_path):
                continue

            if reference_path.startswith("/"):
                resolved = project_root / reference_path.lstrip("/")
            else:
                resolved = html_file.parent / reference_path

            if not resolved.exists():
                relative_file = html_file.relative_to(project_root)
                print(f"Missing reference: {relative_file} -> {reference}")
                missing_count += 1

    if missing_count > 0:
        print(f"Found {missing_count} missing local reference(s).", file=sys.stderr)
        return 1

    print("All local href/src references resolve successfully.")
    return 0
