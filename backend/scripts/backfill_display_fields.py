#!/usr/bin/env python3
"""Populate display_label / sub_state for existing extracted_values and
risk_factor_changes rows.

Run from the backend directory with SUPABASE_* in .env::

    python scripts/backfill_display_fields.py

Idempotent — re-running recomputes the same values from the canonical
inputs (metric_key, value_numeric, change_type, factor_text). Intended
to be run once after applying migration 003_citation_display_fields.sql.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from ingest.display_fields import (
    generate_display_label,
    generate_display_label_for_risk_factor,
    generate_sub_state_for_extracted_value,
    sub_state_from_change_type,
)


def main() -> None:
    try:
        from supabase_client import supabase
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc

    ev_rows = (
        supabase.table("extracted_values")
        .select("id, filing_id, ticker, metric_key, value_numeric")
        .execute()
        .data
        or []
    )

    period_by_filing = _period_by_filing(supabase, ev_rows)

    by_metric: dict[tuple[str, str, int | None], float | None] = {}
    for row in ev_rows:
        ticker = row.get("ticker") or ""
        metric_key = row.get("metric_key") or ""
        year = period_by_filing.get(row.get("filing_id"))
        value = _to_float(row.get("value_numeric"))
        by_metric[(ticker, metric_key, year)] = value

    updated_ev = 0
    for row in ev_rows:
        rid = row["id"]
        ticker = row.get("ticker") or ""
        metric_key = row.get("metric_key") or ""
        current_value = _to_float(row.get("value_numeric"))
        prior_value = _prior_value(by_metric, ticker, metric_key, period_by_filing.get(row.get("filing_id")))
        display_label = generate_display_label(metric_key)
        sub_state = generate_sub_state_for_extracted_value(metric_key, current_value, prior_value)
        supabase.table("extracted_values").update(
            {"display_label": display_label, "sub_state": sub_state}
        ).eq("id", rid).execute()
        updated_ev += 1

    rfc_rows = (
        supabase.table("risk_factor_changes")
        .select("id, factor_text, change_type")
        .execute()
        .data
        or []
    )

    updated_rf = 0
    for row in rfc_rows:
        rid = row["id"]
        display_label = generate_display_label_for_risk_factor(row.get("factor_text") or "")
        sub_state = sub_state_from_change_type(row.get("change_type") or "")
        supabase.table("risk_factor_changes").update(
            {"display_label": display_label, "sub_state": sub_state}
        ).eq("id", rid).execute()
        updated_rf += 1

    print(
        f"Updated {updated_ev} extracted_values, {updated_rf} risk_factor_changes."
    )


def _period_by_filing(supabase, ev_rows: list[dict]) -> dict[str, int | None]:
    filing_ids = sorted({row.get("filing_id") for row in ev_rows if row.get("filing_id")})
    if not filing_ids:
        return {}
    res = (
        supabase.table("filings")
        .select("id, period_end_date")
        .in_("id", list(filing_ids))
        .execute()
        .data
        or []
    )
    out: dict[str, int | None] = {}
    for row in res:
        period = str(row.get("period_end_date") or "")
        year = int(period[:4]) if len(period) >= 4 and period[:4].isdigit() else None
        out[row["id"]] = year
    return out


def _prior_value(
    by_metric: dict[tuple[str, str, int | None], float | None],
    ticker: str,
    metric_key: str,
    year: int | None,
) -> float | None:
    """Find the prior-year value for the same ticker+base metric.

    Handles two layouts in the wild:
      - Same metric_key with different filing periods (looks up year - 1).
      - `_fy{year}`-suffixed keys where the prior year lives at a
        different metric_key in the same filing (e.g. net_premiums_fy2024
        is prior to net_premiums_fy2025).
    """
    if year is not None:
        prior = by_metric.get((ticker, metric_key, year - 1))
        if prior is not None:
            return prior

    fy_split = _split_fy_suffix(metric_key)
    if fy_split is not None:
        base, current_year = fy_split
        prior_key = f"{base}_fy{current_year - 1}"
        for (t, k, _), value in by_metric.items():
            if t == ticker and k == prior_key:
                return value
    return None


def _split_fy_suffix(metric_key: str) -> tuple[str, int] | None:
    if "_fy" not in metric_key:
        return None
    base, _, suffix = metric_key.rpartition("_fy")
    if base and suffix.isdigit() and len(suffix) == 4:
        return base, int(suffix)
    return None


def _to_float(raw) -> float | None:
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    main()
