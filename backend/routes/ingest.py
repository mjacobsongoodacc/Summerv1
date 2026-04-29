from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ingest.runner import ingest_ticker


router = APIRouter()


@router.post("/ingest/{ticker}")
def run_ingest(ticker: str) -> dict:
    symbol = ticker.strip().upper()
    try:
        return ingest_ticker(symbol)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "ticker": symbol},
        )
