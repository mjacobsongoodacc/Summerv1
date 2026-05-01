"""Display labels and sub-states attached to citation rows.

These two fields are part of a frozen contract with the frontend source
viewer: every citation must expose a 1-3 word `display_label` (capped at
24 chars) and a `sub_state` selected from a fixed enum. They are computed
from the metric_key and a comparison of current vs prior period values.
"""

from __future__ import annotations

import re

DISPLAY_LABEL_MAX_LEN = 24
_FLAT_THRESHOLD = 0.02

_LABEL_BY_KEY: dict[str, str] = {
    "net_premiums_earned": "Net premiums earned",
    "net_premiums": "Net premiums earned",
    "combined_ratio": "Combined ratio",
    "loss_ratio": "Loss ratio",
    "expense_ratio": "Expense ratio",
    "fcf": "Free cash flow",
    "free_cash_flow": "Free cash flow",
    "fcf_to_ni": "FCF/NI",
    "sbc_pct_ocf": "SBC %OCF",
    "sbc_absolute": "Stock-based comp",
    "net_income": "Net income",
    "revenue": "Revenue",
    "gross_margin": "Gross margin",
    "operating_margin": "Op margin",
    "operating_cash_flow": "Operating cash flow",
    "investment_income": "Investment income",
    "net_realized_gains_securities": "Net realized gains",
    "auditor": "Auditor",
    "ceo": "CEO",
    "cfo": "CFO",
    "board_share_repurchase_authorization": "Buyback auth",
}

_NON_DIRECTIONAL_TOKENS = ("ratio", "margin", "debt", "maturity", "_pct_")
_TEXT_ONLY_BASES = {"auditor", "ceo", "cfo", "board_share_repurchase_authorization"}

_FY_SUFFIX_RE = re.compile(r"_fy(\d{4})$")
_DEBT_RE = re.compile(r"^debt_maturity_(\d{4})$")
_SEGMENT_RE = re.compile(r"^segment_revenue_(.+)$")


def generate_display_label(metric_key: str, period: str | None = None) -> str:
    """Return the persistent display label for a metric_key.

    `period` is reserved for callers that want to disambiguate identical
    base metrics across years; the default mapping does not embed it.
    """
    if not metric_key:
        return ""

    base, _ = _strip_year(metric_key)

    label = _LABEL_BY_KEY.get(base) or _LABEL_BY_KEY.get(metric_key)
    if label is not None:
        return _truncate(label)

    debt_match = _DEBT_RE.match(metric_key)
    if debt_match:
        return _truncate(f"Long-term debt {debt_match.group(1)}")

    seg_match = _SEGMENT_RE.match(metric_key)
    if seg_match:
        return _truncate(f"Segment: {_pretty(seg_match.group(1))}")

    return _truncate(_pretty(base))


def generate_sub_state_for_extracted_value(
    metric_key: str,
    current_value: float | None,
    prior_value: float | None,
) -> str:
    """Classify an extracted value as increasing/decreasing/flat/neutral."""
    base, _ = _strip_year(metric_key)
    if base in _TEXT_ONLY_BASES:
        return "neutral"
    if any(token in metric_key for token in _NON_DIRECTIONAL_TOKENS):
        return "neutral"
    if current_value is None or prior_value is None:
        return "neutral"
    if prior_value == 0:
        if current_value == 0:
            return "flat"
        return "increasing" if current_value > 0 else "decreasing"
    delta = (current_value - prior_value) / abs(prior_value)
    if delta > _FLAT_THRESHOLD:
        return "increasing"
    if delta < -_FLAT_THRESHOLD:
        return "decreasing"
    return "flat"


def generate_display_label_for_risk_factor(factor_text: str) -> str:
    """Produce a display label from a risk factor heading."""
    if not factor_text:
        return ""
    cleaned = re.sub(r"\s+", " ", factor_text).strip()
    head = cleaned.split("\n", 1)[0]
    head = head.split(".", 1)[0]
    words = head.split()
    if not words:
        return ""
    snippet = " ".join(words[:4])
    return _truncate(snippet)


def annotate_extracted_value_rows(rows: list[dict]) -> list[dict]:
    """Populate display_label and sub_state on extracted_values rows.

    sub_state is computed by comparing each row's value to the prior
    fiscal year for the same base metric within `rows`. Rows are mutated
    in place; the list is also returned for chaining.
    """
    by_base_year: dict[tuple[str, int], dict] = {}
    for row in rows:
        base, year = _strip_year(row.get("metric_key", ""))
        if year is not None:
            by_base_year[(base, year)] = row

    for row in rows:
        metric_key = row.get("metric_key", "")
        base, year = _strip_year(metric_key)
        row["display_label"] = generate_display_label(metric_key)
        prior_value: float | None = None
        if year is not None:
            prior_row = by_base_year.get((base, year - 1))
            if prior_row is not None:
                raw_prior = prior_row.get("value_numeric")
                prior_value = float(raw_prior) if raw_prior is not None else None
        raw_current = row.get("value_numeric")
        current_value = float(raw_current) if raw_current is not None else None
        row["sub_state"] = generate_sub_state_for_extracted_value(
            metric_key, current_value, prior_value
        )
    return rows


def annotate_risk_factor_change_rows(rows: list[dict]) -> list[dict]:
    """Populate display_label and sub_state on risk_factor_changes rows."""
    for row in rows:
        row["display_label"] = generate_display_label_for_risk_factor(
            str(row.get("factor_text") or "")
        )
        row["sub_state"] = sub_state_from_change_type(str(row.get("change_type") or ""))
    return rows


def sub_state_from_change_type(change_type: str) -> str:
    if change_type in {"added", "intensified", "removed"}:
        return change_type
    return "neutral"


def _strip_year(metric_key: str) -> tuple[str, int | None]:
    match = _FY_SUFFIX_RE.search(metric_key)
    if match:
        return metric_key[: match.start()], int(match.group(1))
    return metric_key, None


def _pretty(value: str) -> str:
    cleaned = value.replace("_", " ").strip()
    if not cleaned:
        return ""
    return cleaned[0].upper() + cleaned[1:]


def _truncate(label: str) -> str:
    if len(label) <= DISPLAY_LABEL_MAX_LEN:
        return label
    return label[: DISPLAY_LABEL_MAX_LEN - 1].rstrip() + "…"
