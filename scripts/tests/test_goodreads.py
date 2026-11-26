"""Offline tests for the Goodreads snapshot updater: no request leaves the machine."""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image
from typing_extensions import override

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "goodreads_snapshot"))

import update_goodreads_snapshot as updater

RSS = b"""<rss><channel><item><title>New Book</title>
<link>https://www.goodreads.com/review/show/2</link><book_id>2</book_id>
<book_large_image_url>https://example.test/2.jpg</book_large_image_url>
<user_read_at>Tue, 10 Mar 2026 00:00:00 +0000</user_read_at></item></channel></rss>"""


def _jpeg() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (200, 300), (1, 2, 3)).save(buffer, format="JPEG")
    return buffer.getvalue()


def _fake_get(url: str, headers: dict[str, str], timeout_seconds: int) -> bytes:
    del headers, timeout_seconds
    return RSS if "list_rss" in url else _jpeg()


class SnapshotTest(unittest.TestCase):
    @override
    def setUp(self) -> None:
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.snapshot = self.root / "data" / "snapshot.json"
        self.images = self.root / "images" / "goodreads"
        self.snapshot.parent.mkdir()
        self.images.mkdir(parents=True)
        self.snapshot.write_text('{"books": []}\n', encoding="utf-8")
        (self.images / "old.webp").write_bytes(b"old")

    def run_main(self, *extra: str) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        argv = ["--snapshot-path", str(self.snapshot), "--images-dir", str(self.images), *extra]
        with (
            mock.patch.object(updater, "_http_get", _fake_get),
            contextlib.redirect_stdout(out),
            contextlib.redirect_stderr(err),
        ):
            status = updater.main(argv)
        return status, out.getvalue(), err.getvalue()

    def assert_preserved(self) -> None:
        self.assertEqual(self.snapshot.read_text(encoding="utf-8"), '{"books": []}\n')
        self.assertEqual([p.name for p in self.images.iterdir()], ["old.webp"])
        self.assertEqual([p.name for p in self.images.parent.iterdir()], ["goodreads"])
        self.assertEqual([p.name for p in self.snapshot.parent.iterdir()], ["snapshot.json"])

    def test_success_replaces_both_and_redacts_the_key(self) -> None:
        status, out, err = self.run_main("--rss-key", "SECRET")
        self.assertEqual((status, out), (0, ""))
        self.assertNotIn("SECRET", err)
        books = json.loads(self.snapshot.read_text(encoding="utf-8"))["books"]
        self.assertEqual(books[0]["dateRead"], "2026-03-10T00:00:00Z")
        self.assertEqual([p.name for p in self.images.iterdir()], ["2-new-book.webp"])
        self.assertEqual([p.name for p in self.images.parent.iterdir()], ["goodreads"])

    def test_failed_json_swap_restores_the_images(self) -> None:
        real = Path.replace

        def fail_for_json(source: Path, target: Path) -> Path:
            if Path(target) == self.snapshot:
                message = "disk full"
                raise OSError(message)
            return real(source, target)

        with mock.patch.object(Path, "replace", fail_for_json):
            status, _, _ = self.run_main("--rss-key", "SECRET")
        self.assertEqual(status, 1)
        self.assert_preserved()

    def test_interrupt_during_swap_rolls_back(self) -> None:
        def interrupt(source: Path, target: Path) -> Path:
            del source, target
            raise KeyboardInterrupt

        with mock.patch.object(Path, "replace", interrupt):
            status, _, _ = self.run_main("--rss-key", "SECRET")
        self.assertEqual(status, 130)
        self.assert_preserved()

    def test_leftover_backup_is_restored_not_deleted(self) -> None:
        backup = self.images.parent / ".goodreads.backup"
        self.images.rename(backup)
        staged = self.root / "staged"
        staged.mkdir()
        updater._publish(staged, self.images)
        self.assertFalse(backup.exists())
        self.assertTrue(self.images.is_dir())

    def test_malformed_snapshot_fails_cleanly(self) -> None:
        self.snapshot.write_text('{"books": [{"title": 3}]}', encoding="utf-8")
        status, _, err = self.run_main("--source", "widget")
        self.assertEqual(status, 1)
        self.assertEqual([p.name for p in self.images.iterdir()], ["old.webp"])
        self.assertIn("failed", err)

    def test_rss_only_without_a_key_is_an_error(self) -> None:
        with mock.patch.dict("os.environ", clear=True):
            status, _, err = self.run_main("--source", "rss")
        self.assertEqual(status, 1)
        self.assertIn(updater.RSS_KEY_ENV_VAR, err)
        self.assert_preserved()


if __name__ == "__main__":
    unittest.main()
