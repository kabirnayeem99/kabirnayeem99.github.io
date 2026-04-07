"""Visible page header text model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class HeaderText:
    """Visible page header copy."""

    site_title: str
    tagline: str
