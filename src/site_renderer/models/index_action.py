"""Homepage action model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from ..constants import PageId


@dataclass(frozen=True, slots=True)
class IndexAction:
    """A homepage CTA action with either a direct href or an internal page target."""

    label: str
    href: str | None
    page_id: PageId | None
    variant: Literal["primary", "secondary"]
