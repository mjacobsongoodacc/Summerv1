from __future__ import annotations

import difflib
import re
from typing import Any

from bs4 import BeautifulSoup, Tag

HEADING_RE = re.compile(r"^\s*Item\s+(\d+[A-Z]?)\.?\s+(.+?)$", re.IGNORECASE)
SEVERITY_TERMS = ("may not", "could materially", "significant risk", "material adverse", "substantial")


def extract_risk_factors(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    section = next((entry for entry in section_index if str(entry.get("name", "")).lower().startswith("item 1a")), None)
    if not section:
        return []

    soup = BeautifulSoup(cleaned_html, "lxml")
    heading = soup.find(id=section.get("anchor"))
    if not isinstance(heading, Tag):
        return []

    paragraphs: list[Tag] = []
    for sibling in heading.find_next_siblings():
        if sibling.name in {"h1", "h2", "h3", "h4"} and HEADING_RE.match(sibling.get_text(" ", strip=True)):
            break
        if sibling.name == "p" and sibling.get_text(" ", strip=True):
            paragraphs.append(sibling)

    factors: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_anchor = ""
    has_emphasis = any(paragraph.find(["strong", "b"]) for paragraph in paragraphs)

    for paragraph in paragraphs:
        text = _normalize(paragraph.get_text(" ", strip=True))
        if not text:
            continue

        split_here = bool(paragraph.find(["strong", "b"])) or _looks_like_subheading(text)
        if split_here and current_parts:
            factors.append(_build_factor(cleaned_html, current_parts, current_anchor))
            current_parts = []
            current_anchor = ""

        if not current_anchor:
            current_anchor = text
        current_parts.append(text)

    if current_parts:
        factors.append(_build_factor(cleaned_html, current_parts, current_anchor))

    if has_emphasis or factors:
        return factors

    fallback = []
    for paragraph in paragraphs:
        text = _normalize(paragraph.get_text(" ", strip=True))
        if len(text) > 80:
            fallback.append(_build_factor(cleaned_html, [text], text))
    return fallback


def diff_risk_factors(prior_factors: list[dict], current_factors: list[dict]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
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
                {
                    "factor_text": current["text"],
                    "change_type": "added",
                    "char_start": current.get("char_start"),
                    "char_end": current.get("char_end"),
                }
            )
            continue

        prior = prior_factors[best_index]
        prior_matched.add(best_index)
        change_type = "unchanged"
        if _is_intensified(prior["text"], current["text"]):
            change_type = "intensified"
        results.append(
            {
                "factor_text": current["text"],
                "change_type": change_type,
                "char_start": current.get("char_start"),
                "char_end": current.get("char_end"),
            }
        )

    for index, prior in enumerate(prior_factors):
        if index in prior_matched:
            continue
        results.append(
            {
                "factor_text": prior["text"],
                "change_type": "removed",
                "char_start": prior.get("char_start"),
                "char_end": prior.get("char_end"),
            }
        )

    return results


def _build_factor(cleaned_html: str, parts: list[str], anchor_text: str) -> dict[str, Any]:
    text = "\n\n".join(part.strip() for part in parts if part.strip())
    snippet = _normalize(anchor_text or parts[0])[:120]
    char_start = cleaned_html.find(snippet) if snippet else -1
    char_end = char_start + len(snippet) if char_start >= 0 else None
    return {
        "text": text,
        "char_start": char_start if char_start >= 0 else None,
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
