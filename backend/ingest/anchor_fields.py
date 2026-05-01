"""Normalize paragraph text consistently with the frontend for hashing / prefix match."""
from __future__ import annotations

import hashlib
import re
from typing import Any

from bs4 import BeautifulSoup, Tag

ANCHOR_BLOCK_TAGS = ("p", "li", "td", "th", "div")


def normalize_paragraph_text(text: str | None) -> str:
    """Collapse NBSP and unicode spaces before regex (matches frontend anchor normalization)."""
    t = (text or "").replace("\xa0", " ").replace("\u2009", " ").replace("\u2007", " ")
    return re.sub(r"\s+", " ", t).strip()


def _text_from_tag(tag: Tag) -> str:
    """Mirror DOM Node.textContent: descendants concatenated with no separator."""
    return normalize_paragraph_text(tag.get_text())


def _is_leaf_block(tag: Tag) -> bool:
    if tag.name != "div":
        return True
    return not any(
        isinstance(child, Tag) and child.name in ANCHOR_BLOCK_TAGS
        for child in tag.find_all(recursive=False)
    )


def anchor_fields_from_full_text(full_text: str) -> tuple[str, str]:
    """First 120 normalized chars + sha1 hex of full normalized text (matches TS + @noble/sha1)."""
    n = normalize_paragraph_text(full_text)
    h = hashlib.sha1(n.encode("utf-8")).hexdigest()
    return n[:120], h


def anchor_fields_from_tag(tag: Tag) -> tuple[str, str]:
    """Compute anchor fields from a Tag using DOM-textContent semantics (no separator)."""
    return anchor_fields_from_full_text(_text_from_tag(tag))


_BLOCK_OPEN_RE = re.compile(r"<(p|li|td|th|div)\b[^>]*?(/?)>", re.IGNORECASE)
_BLOCK_CLOSE_RE = re.compile(r"</(p|li|td|th|div)\s*>", re.IGNORECASE)


def _innermost_block_range(cleaned_html: str, char_start: int) -> tuple[int, int] | None:
    """Smallest open-to-close span (using regex over the source) that contains char_start."""
    events: list[tuple[int, int, str, int]] = []
    for m in _BLOCK_OPEN_RE.finditer(cleaned_html):
        if m.group(2) == "/":
            continue
        events.append((m.start(), 0, m.group(1).lower(), m.end()))
    for m in _BLOCK_CLOSE_RE.finditer(cleaned_html):
        events.append((m.start(), 1, m.group(1).lower(), m.end()))
    events.sort(key=lambda e: (e[0], e[1]))

    stack: list[tuple[int, str]] = []
    ranges: list[tuple[int, int]] = []
    for pos, kind, name, end in events:
        if kind == 0:
            stack.append((pos, name))
            continue
        for i in range(len(stack) - 1, -1, -1):
            if stack[i][1] == name:
                open_pos, _ = stack.pop(i)
                ranges.append((open_pos, end))
                break

    best: tuple[int, int] | None = None
    for r in ranges:
        if r[0] <= char_start <= r[1] and (best is None or (r[1] - r[0]) < (best[1] - best[0])):
            best = r
    return best


def anchor_fields_at_offset(cleaned_html: str, char_start: int | None) -> tuple[str, str] | None:
    """Find innermost block in cleaned_html that contains char_start, hash its textContent."""
    if char_start is None or char_start < 0 or char_start >= len(cleaned_html):
        return None
    rng = _innermost_block_range(cleaned_html, char_start)
    if rng is None:
        return None
    fragment = cleaned_html[rng[0] : rng[1]]
    soup = BeautifulSoup(fragment, "lxml")
    body = soup.body or soup
    text = normalize_paragraph_text(body.get_text())
    if not text:
        return None
    return anchor_fields_from_full_text(text)


def anchor_fragment_for_factor_text(factor_text: str) -> str:
    """First narrative block aligns with first DOM paragraph for multi-block risk narratives."""
    ft = factor_text.strip()
    if "\n\n" in ft:
        return ft.split("\n\n", 1)[0].strip()
    return ft


def anchor_fields_for_factor_text(factor_text: str) -> tuple[str, str]:
    """Hashes and prefixes first block only — matches cited <p>/<li> in the filing."""
    return anchor_fields_from_full_text(anchor_fragment_for_factor_text(factor_text))


def attach_anchor_fields(
    row: dict[str, Any],
    *,
    full_text_key: str = "paragraph_text",
    cleaned_html: str | None = None,
) -> dict[str, Any]:
    """Tag-based anchor when cleaned_html + char_start are available; full-text fallback otherwise."""
    if cleaned_html is not None:
        offset_anchor = anchor_fields_at_offset(cleaned_html, row.get("char_start"))
        if offset_anchor is not None:
            row["anchor_text"], row["anchor_hash"] = offset_anchor
            return row
    full = row.get(full_text_key) or ""
    at, ah = anchor_fields_from_full_text(str(full))
    row["anchor_text"] = at
    row["anchor_hash"] = ah
    return row
