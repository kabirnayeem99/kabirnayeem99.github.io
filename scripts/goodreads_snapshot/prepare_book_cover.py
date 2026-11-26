#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow>=10"]
# ///
"""Crop/resize an arbitrary book cover image to match the site's Goodreads covers.

Downloaded covers vary wildly in resolution and aspect ratio. This center-crops
the source image to the same 2:3 ratio update_goodreads_snapshot.py now crops
every cover to (matching .gr_grid_book_container img's `aspect-ratio: 2 / 3` in
src/styles/widgets/bookshelf.css), resizes it to that exact resolution, and re-encodes it as
WebP the same way (quality=75, method=6) so a manually swapped cover is
indistinguishable from a fetched one.

Usage:
    ./prepare_book_cover.py path/to/cover.jpg --book-id 12345 --title "Some Book"
    ./prepare_book_cover.py path/to/cover.jpg --output custom-name.webp

The site path of the new cover (its imageLocal value) is printed on stdout; everything
else goes to stderr. Exit status: 0 written, 1 failed, 2 usage error.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - environment guard
    _MISSING_PILLOW = (
        "Pillow is required.\nRun this script directly (uses uv), "
        "or: pip install -r scripts/goodreads_snapshot/requirements.txt"
    )
    raise SystemExit(_MISSING_PILLOW) from exc

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IMAGES_DIR = REPO_ROOT / "astro/public/assets/images/goodreads"

# Matches CROP_ASPECT / MAX_COVER_HEIGHT in update_goodreads_snapshot.py.
DEFAULT_HEIGHT = 475
DEFAULT_WIDTH = round(DEFAULT_HEIGHT * 2 / 3)
WEBP_QUALITY = 75


def _safe_slug(value: str, max_length: int = 60) -> str:
    lowered = value.lower().strip()
    ascii_only = lowered.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return slug[:max_length] or "book"


def crop_to_ratio(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    """Center-crop `image` to the target aspect ratio, then resize to exact dims."""
    target_ratio = target_width / target_height
    width, height = image.size
    current_ratio = width / height

    if current_ratio > target_ratio:
        # Source is wider than target - crop the sides.
        new_width = round(height * target_ratio)
        left = (width - new_width) // 2
        box = (left, 0, left + new_width, height)
    else:
        # Source is taller than target (or already matches) - crop top/bottom.
        new_height = round(width / target_ratio)
        top = (height - new_height) // 2
        box = (0, top, width, top + new_height)

    cropped = image.crop(box)
    return cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)


def _flattened(source: Image.Image) -> Image.Image:
    """`source` as an opaque image.

    Book covers are opaque, and a stray alpha channel from a scanned or edited source
    shouldn't show through as transparent in the grid, so it is flattened onto white.
    """
    if source.mode not in ("RGB", "RGBA"):
        source = source.convert("RGBA" if "A" in source.getbands() else "RGB")
    if source.mode != "RGBA":
        return source
    background = Image.new("RGB", source.size, (255, 255, 255))
    background.paste(source, mask=source.split()[3])
    return background


def prepare_cover(
    source_path: Path,
    destination_path: Path,
    target_width: int = DEFAULT_WIDTH,
    target_height: int = DEFAULT_HEIGHT,
) -> None:
    """Write `source_path` to `destination_path` as a cropped, resized WebP."""
    with Image.open(source_path) as image:
        fitted = crop_to_ratio(_flattened(image), target_width, target_height)

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        fitted.save(destination_path, format="WEBP", quality=WEBP_QUALITY, method=6)


class Arguments(argparse.Namespace):
    """Typed command-line arguments."""

    source: Path
    book_id: str | None
    title: str | None
    output: Path | None
    images_dir: Path
    width: int
    height: int


def _positive_int(value: str) -> int:
    number = int(value)
    if number <= 0:
        message = f"must be a positive integer, got {value}"
        raise argparse.ArgumentTypeError(message)
    return number


def _parse_args(argv: list[str] | None = None) -> Arguments:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        allow_abbrev=False,
    )
    parser.add_argument("source", type=Path, help="path to the source cover image")
    parser.add_argument(
        "--book-id",
        help="Goodreads book id, used with --title to build the standard "
        "<id>-<slug>.webp filename matching update_goodreads_snapshot.py",
    )
    parser.add_argument("--title", help="book title, used to build the filename")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="explicit output filename or path; overrides --book-id/--title. "
        "A bare filename is written into the images directory",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help="directory to write into (default: %(default)s)",
    )
    parser.add_argument(
        "--width", type=_positive_int, default=DEFAULT_WIDTH, help="(default: %(default)s)"
    )
    parser.add_argument(
        "--height", type=_positive_int, default=DEFAULT_HEIGHT, help="(default: %(default)s)"
    )
    return parser.parse_args(argv, namespace=Arguments())


def _destination(args: Arguments) -> Path:
    if args.output is not None:
        is_bare_name = not args.output.is_absolute() and args.output.parent == Path()
        return args.images_dir / args.output if is_bare_name else args.output
    if bool(args.title):
        prefix = f"{args.book_id}-" if bool(args.book_id) else ""
        return args.images_dir / f"{prefix}{_safe_slug(str(args.title))}.webp"
    return args.images_dir / f"{_safe_slug(args.source.stem)}.webp"


def main(argv: list[str] | None = None) -> int:
    """Run the command line; return the exit status."""
    args = _parse_args(argv)

    if not args.source.is_file():
        sys.stderr.write(f"prepare_book_cover: source file not found: {args.source}\n")
        return 1

    destination = _destination(args)
    try:
        prepare_cover(args.source, destination, args.width, args.height)
    except OSError as exc:
        sys.stderr.write(f"prepare_book_cover: {exc}\n")
        return 1

    sys.stderr.write(f"Wrote {destination} ({args.width}x{args.height})\n")
    sys.stdout.write(f"/assets/images/goodreads/{destination.name}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
