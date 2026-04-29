from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from schemas import (
    DashboardPayload,
    DebtMaturity,
    ExtractedValue,
    FilingMetadata,
    RiskFactorChange,
    Segment,
)
from supabase_client import supabase

router = APIRouter()


def _parse_ev(row: dict) -> ExtractedValue:
    return ExtractedValue(
        id=UUID(row["id"]),
        filing_id=UUID(row["filing_id"]),
        ticker=row["ticker"],
        metric_key=row["metric_key"],
        value_numeric=float(row["value_numeric"]) if row.get("value_numeric") is not None else None,
        value_text=row.get("value_text"),
        label=row["label"],
        section=row["section"],
        char_start=int(row["char_start"]),
        char_end=int(row["char_end"]),
        paragraph_text=row["paragraph_text"],
        created_at=row.get("created_at"),
    )


def _parse_rfc(row: dict) -> RiskFactorChange:
    return RiskFactorChange(
        id=UUID(row["id"]),
        ticker=row["ticker"],
        from_filing_id=UUID(row["from_filing_id"]) if row.get("from_filing_id") else None,
        to_filing_id=UUID(row["to_filing_id"]) if row.get("to_filing_id") else None,
        factor_text=row["factor_text"],
        change_type=row["change_type"],
        char_start=int(row["char_start"]) if row.get("char_start") is not None else None,
        char_end=int(row["char_end"]) if row.get("char_end") is not None else None,
        created_at=row.get("created_at"),
    )


def _parse_seg(row: dict) -> Segment:
    return Segment(
        id=UUID(row["id"]),
        filing_id=UUID(row["filing_id"]),
        ticker=row["ticker"],
        segment_name=row["segment_name"],
        metric=row["metric"],
        period=row["period"],
        value=float(row["value"]),
        char_start=int(row["char_start"]) if row.get("char_start") is not None else None,
        char_end=int(row["char_end"]) if row.get("char_end") is not None else None,
    )


def _parse_debt(row: dict) -> DebtMaturity:
    return DebtMaturity(
        id=UUID(row["id"]),
        filing_id=UUID(row["filing_id"]),
        ticker=row["ticker"],
        maturity_year=int(row["maturity_year"]),
        principal=float(row["principal"]),
        interest_rate=float(row["interest_rate"]) if row.get("interest_rate") is not None else None,
        description=row.get("description"),
        char_start=int(row["char_start"]) if row.get("char_start") is not None else None,
        char_end=int(row["char_end"]) if row.get("char_end") is not None else None,
    )


@router.get("/analyze/{ticker}", response_model=DashboardPayload)
async def analyze(ticker: str, industry: str = "Insurance") -> DashboardPayload:
    _ = industry  # reserved for future sector-specific analytics
    sym = ticker.strip().upper()
    try:
        filing_res = (
            supabase.table("filings")
            .select("*")
            .eq("ticker", sym)
            .eq("filing_type", "10-K")
            .order("period_end_date", desc=True)
            .limit(1)
            .execute()
        )
    except APIError as e:
        raise HTTPException(
            status_code=502,
            detail=e.message or "Supabase filings query failed",
        ) from e

    rows = filing_res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail=f"No 10-K filing found for {sym}")

    latest = rows[0]
    filing_id_latest = UUID(latest["id"])

    try:
        filings_all = (
            supabase.table("filings").select("id,period_end_date").eq("ticker", sym).execute().data or []
        )
        ev_res = supabase.table("extracted_values").select("*").eq("ticker", sym).execute()
        rfc_res = supabase.table("risk_factor_changes").select("*").eq("ticker", sym).execute()
        seg_res = supabase.table("segments").select("*").eq("ticker", sym).execute()
        debt_res = supabase.table("debt_maturities").select("*").eq("ticker", sym).execute()
    except APIError as e:
        raise HTTPException(
            status_code=502,
            detail=e.message or "Supabase query failed",
        ) from e

    period_by_filing: dict[UUID, str] = {}
    for f in filings_all:
        period_by_filing[UUID(f["id"])] = str(f["period_end_date"])

    ev_rows = ev_res.data or []
    parsed = [_parse_ev(r) for r in ev_rows]

    by_metric: dict[str, list[ExtractedValue]] = defaultdict(list)
    for ev in parsed:
        by_metric[ev.metric_key].append(ev)

    def sort_key(ev: ExtractedValue) -> str:
        return period_by_filing.get(ev.filing_id, "")

    for key in by_metric:
        by_metric[key].sort(key=sort_key, reverse=True)

    rfcs = [_parse_rfc(r) for r in (rfc_res.data or [])]
    segs = [_parse_seg(r) for r in (seg_res.data or [])]
    debts = [_parse_debt(r) for r in (debt_res.data or [])]

    meta = FilingMetadata(
        id=filing_id_latest,
        ticker=latest["ticker"],
        filing_type=latest["filing_type"],
        period_end_date=latest["period_end_date"],
        filing_date=latest.get("filing_date") or latest["period_end_date"],
        accession_number=latest["accession_number"],
        source_url=latest["source_url"],
    )

    return DashboardPayload(
        filing=meta,
        extracted_values=dict(by_metric),
        risk_factor_changes=rfcs,
        segments=segs,
        debt_maturities=debts,
    )
