from __future__ import annotations

import html
import re
from typing import Iterable

from bs4 import BeautifulSoup, NavigableString, Tag

ITEM_HEADING_RE = re.compile(r"^\s*Item\s+(\d+[A-Z]?)\.?\s+(.+?)$", re.IGNORECASE)
BLOCK_TAGS = {"h1", "h2", "h3", "h4", "p", "div", "li", "table"}
HEADING_TAGS = {"h1", "h2", "h3", "h4"}


def clean_10k_html(raw_html: str) -> tuple[str, list[dict]]:
    soup = BeautifulSoup(raw_html, "lxml")

    for tag in soup.find_all(True):
        name = tag.name.lower() if tag.name else ""
        if name in {"script", "style"} or name.startswith("ix:") or name.startswith("xbrli:"):
            tag.decompose()
            continue
        if _is_hidden(tag):
            tag.decompose()

    root = soup.body or soup
    blocks = list(_iter_blocks(root))
    cleaned_blocks = [_render_block(block) for block in blocks]
    cleaned_html = "\n".join(block for block in cleaned_blocks if block).strip()

    indexed_html, section_index = _inject_section_anchors(cleaned_html)
    return indexed_html, section_index


def _is_hidden(tag: Tag) -> bool:
    if tag.has_attr("hidden") or str(tag.get("aria-hidden", "")).lower() == "true":
        return True

    style = str(tag.get("style", "")).replace(" ", "").lower()
    if "display:none" in style or "visibility:hidden" in style:
        return True

    return False


def _iter_blocks(node: Tag) -> Iterable[Tag]:
    for child in node.children:
        if isinstance(child, NavigableString):
            continue
        if not isinstance(child, Tag):
            continue
        name = child.name.lower()
        if name == "table":
            yield child
            continue
        if name in BLOCK_TAGS:
            if _block_text(child):
                yield child
            continue
        yield from _iter_blocks(child)


def _render_block(tag: Tag) -> str:
    name = tag.name.lower()
    if name in HEADING_TAGS:
        text = _inline_html(tag)
        return f"<{name}>{text}</{name}>" if text else ""

    if name == "table":
        rows_html = []
        for row in tag.find_all("tr"):
            cells_html = []
            for cell in row.find_all(["td", "th"]):
                cell_text = _block_text(cell)
                if cell_text:
                    cells_html.append(f"<td>{html.escape(cell_text)}</td>")
            if cells_html:
                rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
        return f"<table>{''.join(rows_html)}</table>" if rows_html else ""

    text = _inline_html(tag)
    return f"<p>{text}</p>" if text else ""


def _inline_html(tag: Tag) -> str:
    parts: list[str] = []
    for child in tag.children:
        if isinstance(child, NavigableString):
            text = _normalize_ws(str(child))
            if text:
                parts.append(html.escape(text))
            continue
        if not isinstance(child, Tag):
            continue
        child_name = child.name.lower()
        if child_name in {"strong", "b"}:
            inner = _inline_html(child)
            if inner:
                parts.append(f"<strong>{inner}</strong>")
            continue
        if child_name == "br":
            parts.append(" ")
            continue
        nested = _inline_html(child)
        if nested:
            parts.append(nested)
    return _normalize_inline("".join(parts))


def _normalize_inline(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s+(</strong>)", r"\1", value)
    value = re.sub(r"(<strong>)\s+", r"\1", value)
    return value.strip()


def _block_text(tag: Tag) -> str:
    if tag.name and tag.name.lower() == "table":
        rows = []
        for row in tag.find_all("tr"):
            texts = [_normalize_ws(cell.get_text(" ", strip=True)) for cell in row.find_all(["td", "th"])]
            texts = [text for text in texts if text]
            if texts:
                rows.append(" | ".join(texts))
        return "\n".join(rows).strip()
    return _normalize_ws(tag.get_text(" ", strip=True))


def _inject_section_anchors(cleaned_html: str) -> tuple[str, list[dict]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    container = soup.body or soup
    blocks = container.find_all(["h1", "h2", "h3", "h4", "p", "table"], recursive=False)

    section_markers: list[dict] = []
    text_cursor = 0
    previous_block = False

    for block in blocks:
        block_text = _block_text(block)
        if not block_text:
            continue
        if previous_block:
            text_cursor += 2
        start = text_cursor
        if block.name in HEADING_TAGS:
            match = ITEM_HEADING_RE.match(block_text)
            if match:
                anchor = _slugify(block_text)
                block["id"] = anchor
                section_markers.append({"name": block_text, "anchor": anchor, "char_start": start})
        text_cursor += len(block_text)
        previous_block = True

    total_chars = text_cursor
    for index, marker in enumerate(section_markers):
        next_start = section_markers[index + 1]["char_start"] if index + 1 < len(section_markers) else total_chars
        marker["char_end"] = max(marker["char_start"], next_start - 1)

    body = container.decode_contents() if hasattr(container, "decode_contents") else str(container)
    return body.strip(), section_markers


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "section"


def _normalize_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
