"""Generic localized page container model."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Generic, TypeVar

from ..constants import Lang


T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class LocalizedPage(Generic[T]):
    """A page definition keyed by locale."""

    og_type: str
    locales: Mapping[Lang, T]
