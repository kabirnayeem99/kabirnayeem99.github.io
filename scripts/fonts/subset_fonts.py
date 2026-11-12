#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools>=4.50", "brotli>=1.1"]
# ///
"""Subset the self-hosted fonts to the characters the site uses.

Downloads the original faces from Google Fonts (so re-running never subsets an already
subset file), keeps each script's core alphabet plus every character found in the built
site and its content data, and drops the rest: emoji, symbol and arrow blocks, Arabic
presentation forms, unused extended Latin, and so on. Rewrites the files in
astro/public/assets/fonts/ and the matching @font-face unicode-range values in
astro/public/assets/css/styles.source.css.

Run after `npm run build` (it reads astro/dist/), from the repo root:

    scripts/fonts/subset_fonts.py

Core alphabets stay whole even when unused today, because live data (new book titles,
GitHub repo descriptions) can bring in new characters; anything outside a font's set
falls back to the next font in the stack.
"""

from __future__ import annotations

import html
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

from fontTools import subset

REPO_ROOT = Path(__file__).resolve().parents[2]
ASTRO = REPO_ROOT / "astro"
FONTS_DIR = ASTRO / "public/assets/fonts"
CSS_PATH = ASTRO / "public/assets/css/styles.source.css"
TEXT_SOURCES = [
    (ASTRO / "dist", ("*.html", "*.js")),
    (ASTRO / "src/data", ("*.json",)),
    (ASTRO / "src/scripts", ("*.ts",)),
    (ASTRO / "src/lib", ("*.ts",)),
    (ASTRO / "src/components", ("*.astro",)),
    (ASTRO / "src/pages", ("*.astro",)),
]

GOOGLE_CSS = (
    "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;"
    "1,6..72,200..800&family=Tiro+Bangla:ital@0;1&family=Amiri:wght@400;700&family=Gulzar"
    "&display=swap"
)
# A modern browser UA makes Google serve woff2 split by script subset.
BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def r(start: int, end: int) -> set[int]:
    return set(range(start, end + 1))


# Latin: ASCII and the typographic marks always; accented letters only when the content uses
# them (a rare accent in live data falls back to the next serif for that one letter).
LATIN_CORE = r(0x20, 0x7E) | {0xA0, 0xA9, 0xB7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2022}
LATIN_SCAN = r(0xA1, 0xFF) | r(0x2000, 0x206F) | {0x20AC, 0x2122, 0x2212}
# Scanned characters a Latin face may pick up: extended Latin, punctuation, currency, letterlike.
LATIN_EXT_SCAN = r(0x100, 0x24F) | r(0x1E00, 0x1EFF) | r(0x2000, 0x206F) | r(0x20A0, 0x20CF) | r(0x2100, 0x214F)
BENGALI_CORE = r(0x0980, 0x09FF) | {0x0964, 0x0965, 0x200C, 0x200D, 0x25CC}
ARABIC_CORE = r(0x0600, 0x06FF) | {0x200C, 0x200D, 0x200E, 0x200F, 0x25CC}
# Scanned only: supplement / extended / presentation forms (e.g. U+FDFA) when the text uses them.
ARABIC_SCAN = r(0x0750, 0x077F) | r(0x08A0, 0x08FF) | r(0xFB50, 0xFDFF) | r(0xFE70, 0xFEFF)


@dataclass(frozen=True)
class Face:
    family: str
    style: str  # normal | italic
    weight: str  # as in the Google CSS, e.g. "400" or "200 800"
    google_subset: str  # which Google subset file to start from
    out_name: str
    core: set[int]
    scan: set[int]


FACES = [
    Face("Newsreader", "normal", "200 800", "latin", "newsreader_latin_normal_200-800.woff2", LATIN_CORE, LATIN_SCAN),
    Face("Newsreader", "italic", "200 800", "latin", "newsreader_latin_italic_200-800.woff2", LATIN_CORE, LATIN_SCAN),
    Face("Newsreader", "normal", "200 800", "latin-ext", "newsreader_latin-ext_normal_200-800.woff2", set(), LATIN_EXT_SCAN),
    Face("Newsreader", "italic", "200 800", "latin-ext", "newsreader_latin-ext_italic_200-800.woff2", set(), LATIN_EXT_SCAN),
    Face("Tiro Bangla", "normal", "400", "bengali", "tiro-bangla_bengali_normal_400.woff2", BENGALI_CORE, set()),
    Face("Tiro Bangla", "italic", "400", "bengali", "tiro-bangla_bengali_italic_400.woff2", BENGALI_CORE, set()),
    Face("Amiri", "normal", "400", "arabic", "amiri_arabic_normal_400.woff2", ARABIC_CORE, ARABIC_SCAN),
    Face("Amiri", "normal", "700", "arabic", "amiri_arabic_normal_700.woff2", ARABIC_CORE, ARABIC_SCAN),
    Face("Gulzar", "normal", "400", "arabic", "gulzar_arabic_normal_400.woff2", ARABIC_CORE, ARABIC_SCAN),
]


def fetch(url: str) -> bytes:
    with urlopen(Request(url, headers={"User-Agent": BROWSER_UA}), timeout=30) as response:
        return response.read()


def google_sources() -> dict[tuple[str, str, str, str], str]:
    """(family, style, weight, subset) -> woff2 URL, from the Google Fonts CSS."""
    css = fetch(GOOGLE_CSS).decode("utf-8")
    sources: dict[tuple[str, str, str, str], str] = {}
    for subset_name, body in re.findall(r"/\* ([\w-]+) \*/\s*@font-face \{(.*?)\}", css, re.S):
        family = re.search(r"font-family: '([^']+)'", body).group(1)
        style = re.search(r"font-style: (\w+)", body).group(1)
        weight = re.search(r"font-weight: ([\d ]+);", body).group(1).strip()
        url = re.search(r"url\((\S+?)\)", body).group(1)
        sources[(family, style, weight, subset_name)] = url
    return sources


def used_codepoints() -> set[int]:
    if not (ASTRO / "dist").is_dir():
        sys.exit("astro/dist not found: run `npm run build` in astro/ first.")
    chars: set[int] = set()
    for root, patterns in TEXT_SOURCES:
        for pattern in patterns:
            for path in root.rglob(pattern):
                text = html.unescape(path.read_text(encoding="utf-8", errors="ignore"))
                # JSON / JS escapes such as অ count too.
                text += "".join(chr(int(h, 16)) for h in re.findall(r"\\u([0-9a-fA-F]{4})", text))
                chars.update(ord(c) for c in text)
    return chars


def to_unicode_range(codepoints: set[int]) -> str:
    points = sorted(codepoints)
    spans: list[str] = []
    start = prev = points[0]
    for cp in points[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        spans.append(f"U+{start:04X}" if start == prev else f"U+{start:04X}-{prev:04X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(spans)


def subset_face(source: Path, target: Path, unicodes: set[int]) -> set[int]:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # shaping (Arabic joining, Bengali conjuncts), kerning, ligatures
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    options.drop_tables += ["DSIG"]
    font = subset.load_font(str(source), options)
    available = set(font.getBestCmap() or {})
    keep = unicodes & available
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=sorted(keep))
    subsetter.subset(font)
    subset.save_font(font, str(target), options)
    return keep


def rewrite_css_range(css: str, face: Face, unicode_range: str) -> str:
    pattern = re.compile(
        r'(@font-face \{\n  font-family: "' + re.escape(face.family) + r'";\n'
        r'  src: url\("\.\./fonts/' + re.escape(face.out_name) + r'"\) format\("woff2"\);\n'
        r"(?:  [^\n]*\n)*?)  unicode-range: [^;]+;"
    )
    new_css, count = pattern.subn(lambda m: f"{m.group(1)}  unicode-range: {unicode_range};", css)
    if count != 1:
        sys.exit(f"Could not find the @font-face rule for {face.out_name} in {CSS_PATH.name}.")
    return new_css


def main() -> int:
    used = used_codepoints()
    sources = google_sources()
    css = CSS_PATH.read_text(encoding="utf-8")

    with tempfile.TemporaryDirectory(prefix="font-subset-") as tmp:
        tmp_dir = Path(tmp)
        for face in FACES:
            url = sources.get((face.family, face.style, face.weight, face.google_subset))
            if url is None:
                sys.exit(f"Google Fonts no longer lists {face.family} {face.style} {face.weight} {face.google_subset}.")
            original = tmp_dir / f"src-{face.out_name}"
            original.write_bytes(fetch(url))

            wanted = face.core | (used & face.scan) | (used & face.core)
            if not wanted:
                sys.exit(f"Nothing to keep for {face.out_name}.")
            target = FONTS_DIR / face.out_name
            before = target.stat().st_size if target.exists() else 0
            kept = subset_face(original, target, wanted)
            if not kept:
                # e.g. no extended Latin in use: keep a tiny face so the CSS stays valid.
                kept = subset_face(original, target, {0x0100})
            css = rewrite_css_range(css, face, to_unicode_range(kept))
            print(
                f"{face.out_name}: {len(kept)} chars, "
                f"{before / 1024:.0f} KB -> {target.stat().st_size / 1024:.0f} KB"
            )

    CSS_PATH.write_text(css, encoding="utf-8")
    print(f"updated unicode-range in {CSS_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
