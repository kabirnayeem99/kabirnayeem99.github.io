"""Shared mapping aliases across renderer models."""

from __future__ import annotations

from collections.abc import Mapping

from ..constants import Lang, PageId


RouteMap = Mapping[Lang, str]
RouteTable = Mapping[PageId, RouteMap]
NavigationTable = Mapping[Lang, tuple[PageId, ...]]
NavigationLabels = Mapping[PageId, Mapping[Lang, str]]
