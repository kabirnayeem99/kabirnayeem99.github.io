"""CSS/HTML minification helpers for generated outputs."""

from __future__ import annotations

import re

from .constants import GENERATED_COMMENT
from .models import ContentSchemaError

def strip_css_comments(source: str) -> str:
    """Remove block comments from CSS while preserving string literals.

    The implementation is intentionally conservative and only understands the
    CSS constructs used in this repository. It avoids regex-only comment
    stripping so quoted `/* ... */` sequences remain intact.
    """

    result: list[str] = []
    index = 0
    in_string = False
    string_delimiter = ""
    length = len(source)
    while index < length:
        current = source[index]
        next_char = source[index + 1] if index + 1 < length else ""
        if in_string:
            result.append(current)
            if current == "\\" and index + 1 < length:
                result.append(source[index + 1])
                index += 2
                continue
            if current == string_delimiter:
                in_string = False
                string_delimiter = ""
            index += 1
            continue
        if current in ('"', "'"):
            in_string = True
            string_delimiter = current
            result.append(current)
            index += 1
            continue
        if current == "/" and next_char == "*":
            comment_end = source.find("*/", index + 2)
            if comment_end == -1:
                raise ContentSchemaError("assets/css/styles.source.css contains an unterminated CSS comment")
            index = comment_end + 2
            continue
        result.append(current)
        index += 1
    return "".join(result)


def collapse_css_whitespace(source: str) -> str:
    """Collapse runs of CSS whitespace outside string literals to one space."""

    result: list[str] = []
    in_string = False
    string_delimiter = ""
    pending_space = False
    index = 0
    length = len(source)
    while index < length:
        current = source[index]
        if in_string:
            if pending_space:
                result.append(" ")
                pending_space = False
            result.append(current)
            if current == "\\" and index + 1 < length:
                result.append(source[index + 1])
                index += 2
                continue
            if current == string_delimiter:
                in_string = False
                string_delimiter = ""
            index += 1
            continue
        if current in ('"', "'"):
            if pending_space:
                result.append(" ")
                pending_space = False
            in_string = True
            string_delimiter = current
            result.append(current)
            index += 1
            continue
        if current.isspace():
            pending_space = True
            index += 1
            continue
        if pending_space and result:
            result.append(" ")
            pending_space = False
        result.append(current)
        index += 1
    return "".join(result).strip()


def minify_css(source: str) -> str:
    """Produce a compact CSS payload from the readable source stylesheet."""

    collapsed = collapse_css_whitespace(strip_css_comments(source))
    minified = re.sub(r"\s*([{}:;,])\s*", r"\1", collapsed)
    minified = re.sub(r"\)\s+\{", "){", minified)
    minified = re.sub(r"\s*>\s*", ">", minified)
    minified = re.sub(r";}", "}", minified)
    return minified.strip() + "\n"


def minify_html_document(document: str) -> str:
    """Minify generated HTML without altering text-node semantics.

    The renderer only strips whitespace between tags and removes the generated
    build comment. It does not rewrite text content, attribute values, or inline
    HTML fragments coming from the content source.
    """

    without_comment = document.replace(f"{GENERATED_COMMENT}\n", "")
    return re.sub(r">\s+<", "><", without_comment).strip() + "\n"


