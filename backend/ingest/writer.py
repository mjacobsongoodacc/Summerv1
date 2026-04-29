from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from supabase_client import supabase


def reset_ticker_data(ticker: str) -> None:
    for table_name in ("risk_factor_changes", "extracted_values", "segments", "debt_maturities"):
        supabase.table(table_name).delete().eq("ticker", ticker).execute()
    supabase.table("filings").delete().eq("ticker", ticker).execute()


def write_filing(ticker: str, filing_data: dict[str, Any]) -> str:
    payload = {
        "ticker": ticker,
        "filing_type": "10-K",
        "period_end_date": filing_data["period_end_date"],
        "accession_number": filing_data["accession_number"],
        "source_url": filing_data["source_url"],
        "cleaned_html": filing_data["cleaned_html"],
        "section_index": filing_data["section_index"],
    }
    response = (
        supabase.table("filings")
        .upsert(payload, on_conflict="accession_number")
        .execute()
    )
    row = (response.data or [None])[0]
    if not row:
        lookup = (
            supabase.table("filings")
            .select("id")
            .eq("accession_number", filing_data["accession_number"])
            .limit(1)
            .execute()
        )
        row = (lookup.data or [None])[0]
    if not row:
        raise RuntimeError(f"Failed to write filing {filing_data['accession_number']}")
    return row["id"]


def write_extracted_values(filing_id: str, ticker: str, values: Iterable[dict[str, Any]]) -> int:
    prepared = []
    metric_keys: set[str] = set()
    for value in values:
        metric_key = value["metric_key"]
        metric_keys.add(metric_key)
        prepared.append({"filing_id": filing_id, "ticker": ticker, **value})

    for metric_key in metric_keys:
        supabase.table("extracted_values").delete().eq("ticker", ticker).eq("metric_key", metric_key).execute()

    if prepared:
        supabase.table("extracted_values").insert(prepared).execute()
    return len(prepared)


def write_risk_factor_changes(
    ticker: str,
    from_filing_id: str,
    to_filing_id: str,
    changes: Iterable[dict[str, Any]],
) -> int:
    prepared = [
        {
            "ticker": ticker,
            "from_filing_id": from_filing_id,
            "to_filing_id": to_filing_id,
            **change,
        }
        for change in changes
    ]
    supabase.table("risk_factor_changes").delete().eq("ticker", ticker).execute()
    if prepared:
        supabase.table("risk_factor_changes").insert(prepared).execute()
    return len(prepared)


def write_segments(filing_id: str, ticker: str, segments: Iterable[dict[str, Any]]) -> int:
    prepared = [{"filing_id": filing_id, "ticker": ticker, **segment} for segment in segments]
    supabase.table("segments").delete().eq("ticker", ticker).execute()
    if prepared:
        supabase.table("segments").insert(prepared).execute()
    return len(prepared)


def write_debt_maturities(filing_id: str, ticker: str, maturities: Iterable[dict[str, Any]]) -> int:
    prepared = [{"filing_id": filing_id, "ticker": ticker, **maturity} for maturity in maturities]
    supabase.table("debt_maturities").delete().eq("ticker", ticker).execute()
    if prepared:
        supabase.table("debt_maturities").insert(prepared).execute()
    return len(prepared)
