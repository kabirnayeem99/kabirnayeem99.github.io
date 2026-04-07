"""Schema validation error type."""

from __future__ import annotations


class ContentSchemaError(ValueError):
    """Raised when the JSON content source does not match the expected schema."""
