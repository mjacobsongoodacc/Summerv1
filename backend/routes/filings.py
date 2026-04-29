from uuid import UUID

from fastapi import APIRouter, HTTPException

from schemas import FilingDetailResponse
from supabase_client import supabase

router = APIRouter()


@router.get("/filings/{filing_id}", response_model=FilingDetailResponse)
async def get_filing(filing_id: UUID) -> FilingDetailResponse:
    res = supabase.table("filings").select("*").eq("id", str(filing_id)).limit(1).execute()
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Filing not found")
    row = rows[0]
    section_index = row.get("section_index") or []
    if isinstance(section_index, str):
        section_index = []
    return FilingDetailResponse(
        id=UUID(row["id"]),
        ticker=row["ticker"],
        filing_type=row["filing_type"],
        period_end_date=row["period_end_date"],
        source_url=row["source_url"],
        cleaned_html=row.get("cleaned_html") or "",
        section_index=section_index if isinstance(section_index, list) else [],
    )
