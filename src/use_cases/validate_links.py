"""Use-case: validate that local href/src references resolve to files."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from collections.abc import Callable, Sequence
from pathlib import Path


_ATTR_PATTERN = re.compile(r'(?:href|src)="([^"]+)"')
_HTML_GLOBS: tuple[str, ...] = ("*.html", "ar/*.html", "bn/*.html", "ur/*.html")


@dataclass(frozen=True, slots=True)
class HtmlDocument:
    """One rendered HTML file paired with its full text."""

    path: Path
    contents: str


@dataclass(frozen=True, slots=True)
class MissingReference:
    """A missing local reference discovered in one HTML file."""

    html_file: Path
    reference: str


def _is_ignorable_reference(value: str) -> bool:
    return (
        value == ""
        or value.startswith("http://")
        or value.startswith("https://")
        or value.startswith("mailto:")
        or value.startswith("#")
        or value.startswith("javascript:")
    )


def extract_html_references(contents: str) -> tuple[str, ...]:
    """Extract raw href/src values from one HTML document."""

    return tuple(match.strip() for match in _ATTR_PATTERN.findall(contents))


def strip_fragment_and_query(reference: str) -> str:
    """Strip #fragment and ?query from one reference string."""

    return reference.split("#", 1)[0].split("?", 1)[0]


def resolve_reference_path(project_root: Path, html_file: Path, reference_path: str) -> Path:
    """Resolve one reference path to an absolute filesystem location."""

    if reference_path.startswith("/"):
        return project_root / reference_path.lstrip("/")
    return html_file.parent / reference_path


def find_missing_references(
    document: HtmlDocument,
    *,
    project_root: Path,
    exists: Callable[[Path], bool],
) -> tuple[MissingReference, ...]:
    """Return missing local references for one HTML document."""

    missing: list[MissingReference] = []
    for reference in extract_html_references(document.contents):
        reference_path = strip_fragment_and_query(reference)
        if _is_ignorable_reference(reference_path):
            continue

        resolved_path = resolve_reference_path(project_root, document.path, reference_path)
        if not exists(resolved_path):
            missing.append(MissingReference(html_file=document.path, reference=reference))
    return tuple(missing)


def collect_html_documents(project_root: Path, globs: Sequence[str] = _HTML_GLOBS) -> tuple[HtmlDocument, ...]:
    """Read rendered HTML files into in-memory document objects."""

    html_files: list[Path] = []
    for pattern in globs:
        html_files.extend(sorted(project_root.glob(pattern)))

    return tuple(
        HtmlDocument(path=html_file, contents=html_file.read_text(encoding="utf-8"))
        for html_file in html_files
    )


def find_all_missing_references(
    documents: Sequence[HtmlDocument],
    *,
    project_root: Path,
    exists: Callable[[Path], bool],
) -> tuple[MissingReference, ...]:
    """Return missing local references across many HTML documents."""

    findings: list[MissingReference] = []
    for document in documents:
        findings.extend(
            find_missing_references(
                document,
                project_root=project_root,
                exists=exists,
            )
        )
    return tuple(findings)


def format_missing_reference(finding: MissingReference, project_root: Path) -> str:
    """Render one missing-reference finding line for terminal output."""

    relative_file = finding.html_file.relative_to(project_root)
    return f"Missing reference: {relative_file} -> {finding.reference}"


def run(*, root: Path | None = None) -> int:
    """Validate local references. Returns an exit status code."""

    project_root = (root or Path(__file__).resolve().parent.parent.parent).resolve()
    documents = collect_html_documents(project_root)
    findings = find_all_missing_references(
        documents,
        project_root=project_root,
        exists=Path.exists,
    )
    for finding in findings:
        print(format_missing_reference(finding, project_root))

    if findings:
        print(f"Found {len(findings)} missing local reference(s).", file=sys.stderr)
        return 1

    print("All local href/src references resolve successfully.")
    return 0
