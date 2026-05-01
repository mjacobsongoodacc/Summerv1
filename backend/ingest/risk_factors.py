from __future__ import annotations

import difflib
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, NavigableString, Tag

from ingest.anchor_fields import anchor_fields_at_offset, anchor_fields_for_factor_text
from ingest.display_fields import annotate_risk_factor_change_rows

HEADING_RE = re.compile(r"^\s*Item\s+(\d+[A-Z]?)\.?\s+(.+?)$", re.IGNORECASE)
SEVERITY_TERMS = ("may not", "could materially", "significant risk", "material adverse", "substantial")
ITEM1A_RE = re.compile(r"^\s*item\s+1a\b", re.IGNORECASE)
SECTION_BLOCK_TAGS = {"p", "div", "li"}
DEBUG_DUMP_PATH = Path("/tmp/item1a_section_dump.html")


def extract_risk_factors(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    section = next((entry for entry in section_index if ITEM1A_RE.match(str(entry.get("name", "")))), None)
    print(f"[extract_risk_factors] item1a entry found: {bool(section)}")
    if section is not None:
        print(f"[extract_risk_factors] matched section: {section.get('name')} | anchor={section.get('anchor')}")
    else:
        matching_entries = [entry for entry in section_index if "1a" in str(entry.get("name", "")).lower()]
        print(f"[extract_risk_factors] item1a-like entries: {[entry.get('name') for entry in matching_entries]}")
    if not section:
        return []

    section_html = _extract_item_section_html(cleaned_html, section)
    if not section_html:
        print("[extract_risk_factors] section slice was empty; unable to extract risk factors from this filing")
        return []

    print(f"[extract_risk_factors] section_index char_start={section.get('char_start')} char_end={section.get('char_end')}")
    print(f"[extract_risk_factors] section content length={len(section_html)}")
    print(f"[extract_risk_factors] section first 200 chars={section_html[:200]!r}")

    soup = BeautifulSoup(section_html, "lxml")
    blocks = _collect_section_blocks(soup)
    print(f"[extract_risk_factors] candidate factor blocks={len(blocks)}")

    if not blocks:
        print("[extract_risk_factors] no content blocks found; will dump section HTML for inspection")
        _dump_section_snapshot(section_html)
        return []

    factors: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_paragraphs: list[Tag] = []
    current_anchor = ""
    has_emphasis = any(_has_descendant_strong(block) for block in blocks)

    for block in blocks:
        text = _normalize(block.get_text(" ", strip=True))
        if not text:
            continue

        split_here = _has_heading_boundary(block, text)
        if split_here and current_parts:
            factors.append(_build_factor(cleaned_html, current_parts, current_anchor, current_paragraphs))
            current_parts = []
            current_paragraphs = []
            current_anchor = ""

        if not current_anchor:
            current_anchor = text
        current_parts.append(text)
        current_paragraphs.append(block)

    if current_parts:
        factors.append(_build_factor(cleaned_html, current_parts, current_anchor, current_paragraphs))

    factors = [factor for factor in factors if not _is_outline_factor(factor["text"])]
    if not factors:
        print("[extract_risk_factors] zero factors found after splitter fallback; dumping section HTML")
        _dump_section_snapshot(section_html)

    if has_emphasis or factors:
        return factors

    fallback = []
    for paragraph in paragraphs:
        text = _normalize(paragraph.get_text(" ", strip=True))
        if len(text) > 80:
            fallback.append(_build_factor(cleaned_html, [text], text, [paragraph]))
    return fallback


def _extract_item_section_html(cleaned_html: str, section: dict[str, Any]) -> str:
    start = _coerce_index(section.get("char_start"))
    end = _coerce_index(section.get("char_end"))
    if start is not None and end is not None:
        if start > end:
            start, end = end, start
        section_html = cleaned_html[start : min(len(cleaned_html), end + 1)]
        if section_html:
            return section_html

    soup = BeautifulSoup(cleaned_html, "lxml")
    heading = soup.find(id=section.get("anchor"))
    if not isinstance(heading, Tag):
        return ""

    blocks: list[str] = []
    for sibling in heading.find_next_siblings():
        if _is_item_heading(sibling):
            break
        if isinstance(sibling, Tag):
            blocks.append(str(sibling))
    return "".join(blocks)


def _coerce_index(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _collect_section_blocks(soup: BeautifulSoup) -> list[Tag]:
    blocks: list[Tag] = []
    for tag in soup.find_all(SECTION_BLOCK_TAGS):
        if not isinstance(tag, Tag):
            continue
        text = _normalize(tag.get_text(" ", strip=True))
        if not text:
            continue
        if _is_wrapping_block(tag):
            continue
        blocks.append(tag)
    return blocks


def _is_wrapping_block(tag: Tag) -> bool:
    has_direct_text = any(
        isinstance(child, NavigableString) and str(child).strip()
        for child in tag.children
    )
    if has_direct_text:
        return False
    return any(child.name in SECTION_BLOCK_TAGS for child in tag.find_all(recursive=False) if isinstance(child, Tag))


def _has_descendant_strong(tag: Tag) -> bool:
    return bool(tag.find(["strong", "b"]))


def _has_heading_boundary(tag: Tag, text: str) -> bool:
    if _has_short_bold_heading(tag):
        return True
    return _looks_like_subheading(text)


def _has_short_bold_heading(tag: Tag) -> bool:
    for bold in tag.find_all(["strong", "b"]):
        text = _normalize(bold.get_text(" ", strip=True))
        if text and len(text) < 120 and not text.endswith("."):
            return True
    return False


def _is_item_heading(tag: Tag) -> bool:
    if tag.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
        return bool(HEADING_RE.match(tag.get_text(" ", strip=True)))
    text = _normalize(tag.get_text(" ", strip=True))
    return bool(HEADING_RE.match(text))


def _dump_section_snapshot(section_html: str) -> None:
    try:
        DEBUG_DUMP_PATH.write_text(section_html[:5000], encoding="utf-8")
        print(f"[extract_risk_factors] wrote item1a snapshot to {DEBUG_DUMP_PATH}")
    except Exception as exc:  # pragma: no cover - best effort for diagnostics
        print(f"[extract_risk_factors] failed to write snapshot: {exc}")


def diff_risk_factors(
    prior_factors: list[dict],
    current_factors: list[dict],
    *,
    prior_cleaned_html: str = "",
    current_cleaned_html: str = "",
) -> list[dict[str, Any]]:
    results: list[tuple[dict[str, Any], str]] = []
    prior_matched: set[int] = set()

    for current in current_factors:
        best_index = -1
        best_score = 0.0
        current_norm = _normalize(current["text"]).lower()

        for index, prior in enumerate(prior_factors):
            if index in prior_matched:
                continue
            prior_norm = _normalize(prior["text"]).lower()
            score = difflib.SequenceMatcher(None, prior_norm, current_norm).ratio()
            prefix_match = prior_norm[:50] and prior_norm[:50] == current_norm[:50]
            if score > best_score or prefix_match:
                best_index = index
                best_score = 1.0 if prefix_match else score

        if best_index == -1 or best_score <= 0.7:
            results.append(
                (
                    {
                        "factor_text": current["text"],
                        "change_type": "added",
                        "char_start": current.get("char_start"),
                        "char_end": current.get("char_end"),
                    },
                    current_cleaned_html,
                )
            )
            continue

        prior = prior_factors[best_index]
        prior_matched.add(best_index)
        change_type = "unchanged"
        if _is_intensified(prior["text"], current["text"]):
            change_type = "intensified"
        results.append(
            (
                {
                    "factor_text": current["text"],
                    "change_type": change_type,
                    "char_start": current.get("char_start"),
                    "char_end": current.get("char_end"),
                },
                current_cleaned_html,
            )
        )

    for index, prior in enumerate(prior_factors):
        if index in prior_matched:
            continue
        results.append(
            (
                {
                    "factor_text": prior["text"],
                    "change_type": "removed",
                    "char_start": prior.get("char_start"),
                    "char_end": prior.get("char_end"),
                },
                prior_cleaned_html,
            )
        )

    enriched = [_enrich_rfc_row(row, html) for row, html in results]
    return annotate_risk_factor_change_rows(enriched)


def _enrich_rfc_row(row: dict[str, Any], cleaned_html: str) -> dict[str, Any]:
    offset_anchor = anchor_fields_at_offset(cleaned_html, row.get("char_start")) if cleaned_html else None
    if offset_anchor is not None:
        row["anchor_text"], row["anchor_hash"] = offset_anchor
        return row
    at, ah = anchor_fields_for_factor_text(str(row.get("factor_text") or ""))
    row["anchor_text"] = at
    row["anchor_hash"] = ah
    return row


def _build_factor(
    cleaned_html: str, parts: list[str], anchor_text: str, paragraphs: list[Tag]
) -> dict[str, Any]:
    text = "\n\n".join(part.strip() for part in parts if part.strip())
    text = re.sub(r"\s*-\s*\d+\s*-\s*", " ", text).strip()

    char_start: int | None = None
    char_end: int | None = None
    if paragraphs:
        first_html = str(paragraphs[0])
        last_html = str(paragraphs[-1])
        cs = cleaned_html.find(first_html)
        if cs >= 0:
            ce_raw = cleaned_html.find(last_html, cs)
            if ce_raw >= 0:
                char_start = cs
                char_end = ce_raw + len(last_html)

    if char_start is None:
        snippet = _normalize(anchor_text or parts[0])[:120]
        cs = cleaned_html.find(snippet) if snippet else -1
        char_start = cs if cs >= 0 else None
        char_end = cs + len(snippet) if cs >= 0 else None

    return {
        "text": text,
        "char_start": char_start,
        "char_end": char_end,
    }


def _looks_like_subheading(text: str) -> bool:
    first_sentence = text.split(".")[0].strip()
    if first_sentence and len(first_sentence) < 120 and not text.endswith("."):
        return True
    if len(text) > 80 and text.count(".") <= 1:
        return True
    return False


def _is_intensified(prior_text: str, current_text: str) -> bool:
    prior_norm = _normalize(prior_text).lower()
    current_norm = _normalize(current_text).lower()
    if len(current_norm) > len(prior_norm) * 1.15:
        return True
    return any(term in current_norm and term not in prior_norm for term in SEVERITY_TERMS)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _is_outline_factor(text: str) -> bool:
    normalized = _normalize(text)
    if not normalized:
        return True
    if normalized.startswith("I.Summary"):
        return True
    if normalized.startswith("•"):
        return True
    if re.match(r"^[IVX]+\.", normalized):
        return True
    return len(normalized) < 80
