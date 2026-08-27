#!/usr/bin/env python3
"""Crop/resize an arbitrary book cover image to match the site's Goodreads covers.

Downloaded covers vary wildly in resolution and aspect ratio. This center-crops
the source image to the same 2:3 ratio update_goodreads_snapshot.py now crops
every cover to (matching .gr_grid_book_container img's `aspect-ratio: 2 / 3` in
styles.source.css), resizes it to that exact resolution, and re-encodes it as
WebP the same way (quality=75, method=6) so a manually swapped cover is
indistinguishable from a fetched one.

Usage:
    python3 prepare_book_cover.py path/to/cover.jpg --book-id 12345 --title "Some Book"
    python3 prepare_book_cover.py path/to/cover.jpg --output custom-name.webp
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit(
        "Pillow is required.\nInstall it with: pip install -r scripts/goodreads_snapshot/requirements.txt"
    ) from exc

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
    return cropped.resize((target_width, target_height), Image.LANCZOS)


def prepare_cover(
    source_path: Path,
    destination_path: Path,
    target_width: int = DEFAULT_WIDTH,
    target_height: int = DEFAULT_HEIGHT,
) -> None:
    with Image.open(source_path) as image:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        # Flatten transparency onto white - book covers are opaque, and a
        # stray alpha channel from a scanned/edited source shouldn't show
        # through as transparent in the grid.
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background

        fitted = crop_to_ratio(image, target_width, target_height)

        destination_path.parent.mkdir(parents=True, exist_ok=True)
        fitted.save(destination_path, format="WEBP", quality=WEBP_QUALITY, method=6)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Path to the source cover image")
    parser.add_argument(
        "--book-id",
        default=None,
        help="Goodreads book id, used with --title to build the standard "
        "<id>-<slug>.webp filename matching update_goodreads_snapshot.py",
    )
    parser.add_argument("--title", default=None, help="Book title, used to build the filename")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Explicit output filename or path. Overrides --book-id/--title. "
        "A bare filename is written into the goodreads images directory.",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help=f"Directory to write into (default: {DEFAULT_IMAGES_DIR})",
    )
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()

    if not args.source.is_file():
        print(f"Source file not found: {args.source}", file=sys.stderr)
        return 1

    if args.output is not None:
        destination = args.output if args.output.is_absolute() or args.output.parent != Path(".") else args.images_dir / args.output
    elif args.book_id and args.title:
        destination = args.images_dir / f"{args.book_id}-{_safe_slug(args.title)}.webp"
    elif args.title:
        destination = args.images_dir / f"{_safe_slug(args.title)}.webp"
    else:
        destination = args.images_dir / f"{_safe_slug(args.source.stem)}.webp"

    prepare_cover(args.source, destination, args.width, args.height)

    print(f"Wrote {destination} ({args.width}x{args.height})")
    print(f"imageLocal: /assets/images/goodreads/{destination.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
