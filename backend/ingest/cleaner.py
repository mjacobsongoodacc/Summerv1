from __future__ import annotations

import html
import re
import warnings

from bs4 import BeautifulSoup, Comment, NavigableString, Tag, XMLParsedAsHTMLWarning

ITEM_HEADING_RE = re.compile(
    r"^\s*Item\s+(?P<num>\d+[A-Z]?)\.?\s+(?P<title>.+?)\s*$",
    re.IGNORECASE | re.DOTALL,
)
ITEM_HEADING_TAGS = ("h1", "h2", "h3", "h4", "h5", "h6", "div", "p", "span")

ALLOWED_TAGS = {
    "table",
    "tr",
    "td",
    "th",
    "thead",
    "tbody",
    "tfoot",
    "colgroup",
    "col",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "sup",
    "sub",
    "br",
    "hr",
    "p",
    "div",
    "span",
    "a",
    *{f"h{i}" for i in range(1, 7)},
}


CELL_ATTRS = frozenset({"colspan", "rowspan", "width", "height", "align", "valign", "style"})
TABLE_ATTRS = frozenset({"style", "width", "border", "cellpadding", "cellspacing", "frame", "rules"})


def clean_10k_html(raw_html: str) -> tuple[str, list[dict]]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", XMLParsedAsHTMLWarning)
        soup = BeautifulSoup(raw_html, "lxml")

    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()

    for tag in list(soup.find_all(True)):
        name = (tag.name or "").lower()
        if name in {"script", "style"}:
            tag.decompose()
            continue
        if name.startswith("ix:") or name.startswith("ixt:") or name.startswith("xbrli:"):
            tag.unwrap()

    for tag in list(soup.find_all(True)):
        if _is_hidden(tag):
            tag.decompose()

    _unwrap_disallowed_tags(soup)

    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        _strip_attributes(tag)

    root = soup.body or soup
    fragment = root.decode_contents() if hasattr(root, "decode_contents") else ""
    cleaned_html = fragment.strip()

    indexed_html, section_index = _inject_item_anchors_and_index(cleaned_html)
    return indexed_html, section_index


def _unwrap_disallowed_tags(soup: BeautifulSoup) -> None:
    changed = True
    while changed:
        changed = False
        for tag in list(soup.find_all(True)):
            if not isinstance(tag, Tag):
                continue
            name = (tag.name or "").lower()
            if name in {"html", "body", "[document]"}:
                continue
            if name.startswith("ix:") or name.startswith("ixt:") or name.startswith("xbrli:"):
                tag.unwrap()
                changed = True
                continue
            if name not in ALLOWED_TAGS:
                tag.unwrap()
                changed = True


def _strip_attributes(tag: Tag) -> None:
    name = (tag.name or "").lower()
    attrs = dict(tag.attrs)
    kept: dict[str, str | list[str]] = {}
    for key, val in attrs.items():
        lk = key.lower()
        if lk == "class":
            continue
        if lk == "style":
            kept[key] = val
            continue
        if name == "a" and lk in {"href", "name"}:
            kept[key] = val
            continue
        if name in {"td", "th"} and lk in CELL_ATTRS:
            kept[key] = val
            continue
        if name == "table" and lk in TABLE_ATTRS:
            kept[key] = val
            continue
        if name in {"colgroup", "col"} and lk in {"span", "style", "width"}:
            kept[key] = val
            continue
        if name in {"div", "span"} and lk == "style":
            kept[key] = val
            continue
        if name in {"p", "h1", "h2", "h3", "h4", "h5", "h6"} and lk == "style":
            kept[key] = val
            continue
        if name == "tr" and lk == "style":
            kept[key] = val
            continue

    tag.attrs = kept


def _is_hidden(tag: Tag) -> bool:
    attrs = tag.attrs or {}
    if "hidden" in attrs or str(attrs.get("aria-hidden", "")).lower() == "true":
        return True
    style = str(attrs.get("style", "")).replace(" ", "").lower()
    if "display:none" in style or "visibility:hidden" in style:
        return True
    return False


def _inject_item_anchors_and_index(cleaned_html: str) -> tuple[str, list[dict]]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", XMLParsedAsHTMLWarning)
        soup = BeautifulSoup(cleaned_html, "lxml")
    container = soup.body if soup.body else soup

    headings: list[tuple[str, str]] = []
    seen_anchors: set[str] = set()
    for h in container.find_all(ITEM_HEADING_TAGS, recursive=True):
        text = _visible_heading_text(h)
        if not text or len(text) > 220:
            continue
        match = ITEM_HEADING_RE.match(text)
        if not match:
            continue
        num = match.group("num").strip()
        title = match.group("title").strip()
        anchor = _item_anchor_slug(num, title)
        if anchor in seen_anchors:
            continue
        seen_anchors.add(anchor)
        h["id"] = anchor
        display_name = f"Item {num}. {title}".strip()
        headings.append((anchor, display_name))

    if soup.body:
        indexed_html = soup.body.decode_contents().strip()
    else:
        indexed_html = str(container)

    section_index: list[dict[str, str | int]] = []
    for i, (anchor, display_name) in enumerate(headings):
        quoted = html.escape(anchor)
        markers = [f'id="{quoted}"', f"id='{quoted}'"]
        pos = -1
        for m in markers:
            pos = indexed_html.find(m)
            if pos >= 0:
                break
        if pos < 0:
            continue
        tag_open = indexed_html.rfind("<", 0, pos)
        char_start = tag_open if tag_open >= 0 else pos
        next_start = len(indexed_html)
        if i + 1 < len(headings):
            na = headings[i + 1][0]
            qn = html.escape(na)
            nm = [f'id="{qn}"', f"id='{qn}'"]
            np = -1
            for m in nm:
                np = indexed_html.find(m, pos + 1)
                if np >= 0:
                    break
            if np >= 0:
                tag_o = indexed_html.rfind("<", 0, np)
                next_start = tag_o if tag_o >= 0 else np
        char_end = max(char_start, next_start - 1)
        section_index.append(
            {
                "name": display_name,
                "anchor": anchor,
                "char_start": char_start,
                "char_end": char_end,
            }
        )

    return indexed_html, section_index


def _visible_heading_text(tag: Tag) -> str:
    parts: list[str] = []
    for child in tag.descendants:
        if isinstance(child, NavigableString):
            parts.append(str(child))
    raw = "".join(parts)
    return re.sub(r"\s+", " ", raw).strip()


def _item_anchor_slug(num: str, title: str) -> str:
    num_part = re.sub(r"[^a-zA-Z0-9]+", "", num).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    slug = slug or "section"
    return f"item-{num_part}-{slug}"
