#!/usr/bin/env python3
"""
Populate anchor_text / anchor_hash for existing extracted_values and risk_factor_changes rows.

Run from backend directory with SUPABASE_* in .env:
  python scripts/backfill_anchor_fields.py

Re-anchors each row from the enclosing leaf block in cleaned_html using DOM-textContent
semantics so JS-side hashing matches without a fallback pass.
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from ingest.anchor_fields import (
    anchor_fields_at_offset,
    anchor_fields_for_factor_text,
    anchor_fields_from_full_text,
)


def main() -> None:
    try:
        from supabase_client import supabase
    except RuntimeError as exc:
        raise SystemExit(str(exc)) from exc

    html_cache: dict[str, str] = {}

    def html_for(filing_id: str | None) -> str:
        if not filing_id:
            return ""
        if filing_id not in html_cache:
            res = (
                supabase.table("filings")
                .select("cleaned_html")
                .eq("id", filing_id)
                .single()
                .execute()
            )
            html_cache[filing_id] = (res.data or {}).get("cleaned_html") or ""
        return html_cache[filing_id]

    ev_rows = (
        supabase.table("extracted_values")
        .select("id, filing_id, paragraph_text, char_start")
        .execute()
        .data
        or []
    )
    updated_ev = ev_offset_hits = 0
    for row in ev_rows:
        fid = row["id"]
        html = html_for(row.get("filing_id"))
        offset_anchor = anchor_fields_at_offset(html, row.get("char_start")) if html else None
        if offset_anchor is not None:
            at, ah = offset_anchor
            ev_offset_hits += 1
        else:
            at, ah = anchor_fields_from_full_text(row.get("paragraph_text") or "")
        supabase.table("extracted_values").update({"anchor_text": at, "anchor_hash": ah}).eq("id", fid).execute()
        updated_ev += 1

    rfc_rows = (
        supabase.table("risk_factor_changes")
        .select("id, factor_text, change_type, char_start, from_filing_id, to_filing_id")
        .execute()
        .data
        or []
    )
    updated_rf = rf_offset_hits = 0
    for row in rfc_rows:
        rid = row["id"]
        filing_id = row.get("from_filing_id") if row.get("change_type") == "removed" else row.get("to_filing_id")
        html = html_for(filing_id)
        offset_anchor = anchor_fields_at_offset(html, row.get("char_start")) if html else None
        if offset_anchor is not None:
            at, ah = offset_anchor
            rf_offset_hits += 1
        else:
            at, ah = anchor_fields_for_factor_text(row.get("factor_text") or "")
        supabase.table("risk_factor_changes").update({"anchor_text": at, "anchor_hash": ah}).eq("id", rid).execute()
        updated_rf += 1

    print(
        f"Updated {updated_ev} extracted_values ({ev_offset_hits} via offset), "
        f"{updated_rf} risk_factor_changes ({rf_offset_hits} via offset)."
    )


if __name__ == "__main__":
    main()
