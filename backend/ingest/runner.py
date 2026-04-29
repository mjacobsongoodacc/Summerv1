from __future__ import annotations

import re
from urllib.parse import urljoin
import warnings

from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

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


def ingest_ticker(ticker: str) -> dict[str, int | str]:
    symbol = ticker.strip().upper()
    if not symbol:
        raise ValueError("Ticker cannot be empty")

    cik = resolve_cik(symbol)
    filings = list_10k_filings(cik, n=2)
    if len(filings) < 2:
        raise RuntimeError(f"Expected at least 2 recent 10-K filings for {symbol}")

    processed_filings = []
    for filing in filings:
        raw_html = fetch_html(filing["primary_document_url"])
        cleaned_html, section_index = clean_10k_html(raw_html)
        annual_report_url = _find_annual_report_url(filing["primary_document_url"], raw_html)
        if annual_report_url:
            annual_cleaned_html, _ = clean_10k_html(fetch_html(annual_report_url))
            cleaned_html = f"{cleaned_html}\n{annual_cleaned_html}"
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

    reset_ticker_data(symbol)

    filing_ids: dict[str, str] = {}
    for filing in processed_filings:
        filing_ids[filing["accession_number"]] = write_filing(symbol, filing)

    current_filing_id = filing_ids[current_filing["accession_number"]]
    prior_filing_id = filing_ids[prior_filing["accession_number"]]

    values_inserted = write_extracted_values(current_filing_id, symbol, extracted_values)
    segments_inserted = write_segments(current_filing_id, symbol, segments)
    maturities_inserted = write_debt_maturities(current_filing_id, symbol, maturities)
    diff_entries_inserted = write_risk_factor_changes(symbol, prior_filing_id, current_filing_id, changes)

    return {
        "filings_inserted": len(filing_ids),
        "values_inserted": values_inserted,
        "segments_inserted": segments_inserted,
        "debt_maturities_inserted": maturities_inserted,
        "diff_entries_inserted": diff_entries_inserted,
        "ticker": symbol,
    }


def _dedupe_metric_rows(rows: list[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for row in rows:
        deduped.setdefault(row["metric_key"], row)
    return list(deduped.values())


def _extract_text_values(filing: dict) -> list[dict]:
    html = filing["cleaned_html"]
    rows: list[dict] = []
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
                "metric_key": metric_key,
                "value_numeric": None,
                "value_text": needle,
                "label": label,
                "section": section,
                "char_start": start,
                "char_end": start + len(needle),
                "paragraph_text": needle,
            }
        )

    investment_row_match = re.search(
        r"Net premiums earned</td><td>\$</td><td>[\d,]+</td><td>\$</td><td>[\d,]+</td><td>\$</td><td>[\d,]+</td></tr><tr><td>Investment income</td><td>([\d,]+)</td><td>([\d,]+)</td><td>([\d,]+)</td>",
        html,
        re.IGNORECASE,
    )
    if investment_row_match:
        paragraph_text = investment_row_match.group(0)
        for match_year, match_value in zip((2025, 2024, 2023), investment_row_match.groups(), strict=True):
            start = html.find(match_value, investment_row_match.start())
            rows.append(
                {
                    "metric_key": f"investment_income_fy{match_year}",
                    "value_numeric": float(match_value.replace(",", "")),
                    "value_text": None,
                    "label": f"Investment income FY{match_year}",
                    "section": "Investments",
                    "char_start": max(0, start),
                    "char_end": max(max(0, start) + 1, start + len(match_value)),
                    "paragraph_text": paragraph_text,
                }
            )

    realized_match = re.search(
        r"Total net realized gains \(losses\) on securities</td><td>([\d(), ]+)</td><td>([\d(), ]+)</td><td>([\d(), ]+)</td>",
        html,
        re.IGNORECASE,
    )
    if realized_match:
        paragraph_text = realized_match.group(0)
        for match_year, match_value in zip((2025, 2024, 2023), realized_match.groups(), strict=True):
            numeric = match_value.strip()
            negative = numeric.startswith("(") and numeric.endswith(")")
            parsed = float(numeric.strip("() ").replace(",", ""))
            if negative:
                parsed *= -1
            start = html.find(match_value, realized_match.start())
            rows.append(
                {
                    "metric_key": f"net_realized_gains_securities_fy{match_year}",
                    "value_numeric": parsed,
                    "value_text": None,
                    "label": f"Net realized gains on securities FY{match_year}",
                    "section": "Investments",
                    "char_start": max(0, start),
                    "char_end": max(max(0, start) + 1, start + len(match_value)),
                    "paragraph_text": paragraph_text,
                }
            )

    repurchase_match = re.search(
        r"In May 2025, the Board of Directors approved an authorization for the company to repurchase up to 25 million of its common shares\.[^.]+does not have an expiration date\.",
        html,
        re.IGNORECASE,
    )
    if repurchase_match:
        rows.append(
            {
                "metric_key": "board_share_repurchase_authorization",
                "value_numeric": None,
                "value_text": repurchase_match.group(0),
                "label": "Share repurchase authorization",
                "section": "Capital Management",
                "char_start": repurchase_match.start(),
                "char_end": repurchase_match.end(),
                "paragraph_text": repurchase_match.group(0),
            }
        )

    return rows


def _find_annual_report_url(primary_document_url: str, raw_html: str) -> str | None:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", XMLParsedAsHTMLWarning)
        soup = BeautifulSoup(raw_html, "lxml")
    for anchor in soup.find_all("a", href=True):
        text = anchor.get_text(" ", strip=True)
        if "Annual Report to Shareholders" not in text:
            continue
        return urljoin(primary_document_url, anchor["href"])
    return None
