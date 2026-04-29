from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from ingest.cleaner import clean_10k_html
from ingest.edgar import fetch_html, list_10k_filings, resolve_cik
from ingest.extractors import (
    extract_capital_metrics,
    extract_debt_maturities,
    extract_financial_trends,
    extract_segments,
)
from ingest.risk_factors import diff_risk_factors, extract_risk_factors
from ingest.writer import (
    reset_ticker_data,
    write_debt_maturities,
    write_extracted_values,
    write_filing,
    write_risk_factor_changes,
    write_segments,
)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/ingest_filing.py <TICKER>")

    ticker = sys.argv[1].strip().upper()
    cik = resolve_cik(ticker)
    filings = list_10k_filings(cik, n=2)
    if len(filings) < 2:
        raise RuntimeError(f"Expected at least 2 recent 10-K filings for {ticker}")

    processed_filings = []
    for filing in filings:
        raw_html = fetch_html(filing["primary_document_url"])
        cleaned_html, section_index = clean_10k_html(raw_html)
        processed_filings.append(
            {
                **filing,
                "source_url": filing["primary_document_url"],
                "cleaned_html": cleaned_html,
                "section_index": section_index,
            }
        )

    processed_filings.sort(key=lambda row: row["period_end_date"], reverse=True)
    current_filing = processed_filings[0]
    prior_filing = processed_filings[1]

    current_risk_factors = extract_risk_factors(current_filing["cleaned_html"], current_filing["section_index"])
    prior_risk_factors = extract_risk_factors(prior_filing["cleaned_html"], prior_filing["section_index"])
    changes = diff_risk_factors(prior_risk_factors, current_risk_factors)

    extracted_values = _dedupe_metric_rows(
        extract_financial_trends(current_filing["cleaned_html"], current_filing["section_index"])
        + extract_capital_metrics(current_filing["cleaned_html"], current_filing["section_index"])
        + _extract_text_values(current_filing)
    )
    segments = extract_segments(current_filing["cleaned_html"], current_filing["section_index"])
    maturities = extract_debt_maturities(current_filing["cleaned_html"], current_filing["section_index"])

    reset_ticker_data(ticker)

    filing_ids: dict[str, str] = {}
    for filing in processed_filings:
        filing_ids[filing["accession_number"]] = write_filing(ticker, filing)

    current_filing_id = filing_ids[current_filing["accession_number"]]
    prior_filing_id = filing_ids[prior_filing["accession_number"]]

    values_inserted = write_extracted_values(current_filing_id, ticker, extracted_values)
    segments_inserted = write_segments(current_filing_id, ticker, segments)
    maturities_inserted = write_debt_maturities(current_filing_id, ticker, maturities)
    diff_inserted = write_risk_factor_changes(ticker, prior_filing_id, current_filing_id, changes)

    print(
        " | ".join(
            [
                f"ticker={ticker}",
                f"filings_inserted={len(filing_ids)}",
                f"values_inserted={values_inserted}",
                f"segments_inserted={segments_inserted}",
                f"debt_maturities_inserted={maturities_inserted}",
                f"diff_entries_inserted={diff_inserted}",
            ]
        )
    )


def _dedupe_metric_rows(rows: list[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for row in rows:
        deduped.setdefault(row["metric_key"], row)
    return list(deduped.values())


def _extract_text_values(filing: dict) -> list[dict]:
    year = str(filing["period_end_date"])[:4]
    html = filing["cleaned_html"]
    rows = []
    text_metrics = {
        "auditor": ("PricewaterhouseCoopers LLP", "Independent registered public accounting firm", "Financial Statements"),
        "ceo": ("Susan Patricia Griffith", "Chief Executive Officer", "Signatures"),
        "cfo": ("John P. Sauerland", "Chief Financial Officer", "Signatures"),
    }
    for metric_key, (needle, label, section) in text_metrics.items():
        start = html.find(needle)
        if start < 0:
            continue
        rows.append(
            {
                "metric_key": metric_key if metric_key in {"auditor", "ceo", "cfo"} else f"{metric_key}_fy{year}",
                "value_numeric": None,
                "value_text": needle,
                "label": label,
                "section": section,
                "char_start": start,
                "char_end": start + len(needle),
                "paragraph_text": needle,
            }
        )
    return rows


if __name__ == "__main__":
    main()
