from __future__ import annotations

import os
import time
from typing import Any

import requests

SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SEC_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data"
REQUEST_SLEEP_SECONDS = 0.1
USER_AGENT = os.getenv(
    "EDGAR_USER_AGENT",
    "Carnegie Screener maxjacobson@example.com",
)

_SESSION = requests.Session()
_SESSION.headers.update(
    {
        "User-Agent": USER_AGENT,
        "Accept-Encoding": "gzip, deflate",
    }
)


def _request(url: str) -> requests.Response:
    response = _SESSION.get(url, timeout=30)
    response.raise_for_status()
    time.sleep(REQUEST_SLEEP_SECONDS)
    return response


def resolve_cik(ticker: str) -> str:
    symbol = ticker.strip().upper()
    payload = _request(SEC_COMPANY_TICKERS_URL).json()

    values: list[dict[str, Any]]
    if isinstance(payload, dict):
        values = [entry for entry in payload.values() if isinstance(entry, dict)]
    elif isinstance(payload, list):
        values = [entry for entry in payload if isinstance(entry, dict)]
    else:
        raise ValueError("Unexpected SEC ticker payload")

    for entry in values:
        if str(entry.get("ticker", "")).upper() == symbol:
            return str(entry["cik_str"]).zfill(10)

    raise ValueError(f"Could not resolve CIK for ticker {symbol}")


def list_10k_filings(cik: str, n: int = 2) -> list[dict[str, str]]:
    padded_cik = str(cik).zfill(10)
    payload = _request(SEC_SUBMISSIONS_URL.format(cik=padded_cik)).json()
    recent = payload.get("filings", {}).get("recent", {})

    accession_numbers = recent.get("accessionNumber", [])
    forms = recent.get("form", [])
    primary_documents = recent.get("primaryDocument", [])
    report_dates = recent.get("reportDate", [])
    filing_dates = recent.get("filingDate", [])

    rows: list[dict[str, str]] = []
    for accession_number, form, primary_document, report_date, filing_date in zip(
        accession_numbers,
        forms,
        primary_documents,
        report_dates,
        filing_dates,
        strict=False,
    ):
        if form != "10-K":
            continue

        accession_no_dashes = str(accession_number).replace("-", "")
        cik_no_padding = str(int(padded_cik))
        period_end_date = report_date or filing_date
        rows.append(
            {
                "accession_number": str(accession_number),
                "period_end_date": str(period_end_date),
                "primary_document_url": (
                    f"{SEC_ARCHIVES_BASE_URL}/{cik_no_padding}/{accession_no_dashes}/{primary_document}"
                ),
            }
        )

    rows.sort(key=lambda row: row["period_end_date"], reverse=True)
    return rows[:n]


def fetch_html(url: str) -> str:
    return _request(url).text
