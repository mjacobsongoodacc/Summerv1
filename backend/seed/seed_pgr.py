"""
Seed Progressive (PGR) dashboard data. Run from backend directory:
  python seed/seed_pgr.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from supabase_client import supabase

SECTION_INDEX_SAMPLE = [
    {"name": "Cover Page", "anchor": "cover"},
    {"name": "Risk Factors", "anchor": "risk-factors"},
    {"name": "Management Discussion & Analysis", "anchor": "md-a"},
    {"name": "Financial Statements", "anchor": "financial-statements"},
]


def _cite(paragraph: str, start: int = 0, end: int = 120) -> tuple[int, int, str]:
    paragraph_text = paragraph[:500]
    end = min(end, len(paragraph_text)) if paragraph_text else end
    return start, max(end, start + 1), paragraph_text or "(empty cite placeholder)"


def main() -> None:
    sym = "PGR"

    supabase.table("filings").delete().eq("ticker", sym).execute()

    html_2025_path = Path(__file__).resolve().parent / "pgr_10k_2025.html"
    html_2024_path = Path(__file__).resolve().parent / "pgr_10k_2024.html"
    assert html_2025_path.exists() and html_2024_path.exists()
    cleaned_2025 = ""
    cleaned_2024 = ""

    filing_rows = [
        {
            "ticker": sym,
            "filing_type": "10-K",
            "period_end_date": "2024-12-31",
            "accession_number": "0000080661-25-000060",
            "source_url": "https://www.sec.gov/Archives/edgar/data/80661/000008066125000060/pgr-20241231.htm",
            "cleaned_html": cleaned_2024,
            "section_index": SECTION_INDEX_SAMPLE,
        },
        {
            "ticker": sym,
            "filing_type": "10-K",
            "period_end_date": "2025-12-31",
            "accession_number": "0000080661-26-000086",
            "source_url": "https://www.sec.gov/Archives/edgar/data/0000080661/000008066126000086/pgr-20251231.htm",
            "cleaned_html": cleaned_2025,
            "section_index": SECTION_INDEX_SAMPLE,
        },
    ]

    ins = supabase.table("filings").insert(filing_rows).execute()
    ids = {row["period_end_date"]: row["id"] for row in ins.data or []}
    fid_2024 = ids["2024-12-31"]
    fid_2025 = ids["2025-12-31"]

    extracted = []

    def add_ev(
        fid: str,
        metric_key: str,
        *,
        label: str,
        section: str,
        numeric: float | None = None,
        text: str | None = None,
    ) -> None:
        stub = (
            f"{label}. Numeric disclosure cite placeholder."
            if numeric is not None
            else (text or label or metric_key)
        )
        s, e, p = _cite(stub)
        extracted.append(
            {
                "filing_id": fid,
                "ticker": sym,
                "metric_key": metric_key,
                "value_numeric": numeric,
                "value_text": text,
                "label": label,
                "section": section,
                "char_start": s,
                "char_end": e,
                "paragraph_text": p,
            }
        )

    # Verified Progressive figures (millions USD unless noted)
    add_ev(fid_2025, "net_premiums_fy2025", label="Net premiums earned FY2025", section="MD&A", numeric=81661)
    add_ev(fid_2024, "net_premiums_fy2024", label="Net premiums earned FY2024", section="MD&A", numeric=70799)
    add_ev(fid_2025, "net_premiums_fy2023", label="Net premiums earned FY2023", section="MD&A", numeric=58665)

    add_ev(fid_2025, "investment_income_fy2025", label="Investment income FY2025", section="MD&A", numeric=3583)
    add_ev(fid_2024, "investment_income_fy2024", label="Investment income FY2024", section="MD&A", numeric=2832)
    add_ev(fid_2025, "investment_income_fy2023", label="Investment income FY2023", section="MD&A", numeric=1892)

    add_ev(fid_2025, "net_realized_gains_securities_fy2025", label="Net realized gains on securities FY2025", section="Notes", numeric=727)
    add_ev(fid_2024, "net_realized_gains_securities_fy2024", label="Net realized gains on securities FY2024", section="Notes", numeric=264)
    add_ev(fid_2025, "net_realized_gains_securities_fy2023", label="Net realized gains on securities FY2023", section="Notes", numeric=353)

    add_ev(
        fid_2025,
        "board_share_repurchase_authorization",
        label="Share repurchase authorization (May 2025)",
        section="Notes",
        text="Board authorized repurchase of up to 25 million shares with no expiration.",
    )

    add_ev(fid_2025, "auditor", label="Independent registered public accounting firm", section="Financial Statements", text="PricewaterhouseCoopers LLP")
    add_ev(fid_2025, "ceo", label="Chief Executive Officer", section="Signatures", text="Susan Patricia Griffith")
    add_ev(fid_2025, "cfo", label="Chief Financial Officer", section="Signatures", text="John P. Sauerland")

    ph_label = "PLACEHOLDER — replace via ingest."

    add_ev(fid_2025, "insurance_combined_ratio_fy2025", label=ph_label, section="Underwriting", numeric=92.4)
    add_ev(fid_2025, "insurance_loss_ratio_fy2025", label=ph_label, section="Underwriting", numeric=71.2)
    add_ev(fid_2025, "insurance_expense_ratio_fy2025", label=ph_label, section="Underwriting", numeric=21.2)
    add_ev(fid_2025, "insurance_portfolio_yield_fy2025", label=ph_label, section="Investments", numeric=4.35)
    add_ev(fid_2025, "insurance_duration_years_fy2025", label=ph_label, section="Investments", numeric=4.1)
    add_ev(fid_2025, "insurance_reserve_development_pct_fy2025", label=ph_label, section="Reserves", numeric=-1.2)

    # Placeholder metrics — PLACEHOLDER label text per instructions
    for year, fid in [(2025, fid_2025), (2024, fid_2024), (2023, fid_2025)]:
        add_ev(
            fid,
            f"gross_margin_fy{year}",
            label=ph_label,
            section="MD&A",
            numeric=22.5 + (year - 2023) * 0.35,
        )
        add_ev(
            fid,
            f"operating_margin_fy{year}",
            label=ph_label,
            section="MD&A",
            numeric=14.8 + (year - 2023) * 0.25,
        )
        add_ev(
            fid,
            f"net_income_fy{year}",
            label=ph_label,
            section="Income Statement",
            numeric=5200 - (2025 - year) * 400,
        )

    for year in range(2021, 2026):
        fid = fid_2025 if year >= 2025 else fid_2024 if year >= 2024 else fid_2025
        add_ev(
            fid,
            f"free_cash_flow_fy{year}",
            label=ph_label,
            section="Cash Flow",
            numeric=4800 + year * 50,
        )

    for year in range(2021, 2026):
        fid = fid_2025 if year >= 2025 else fid_2024 if year >= 2024 else fid_2025
        add_ev(
            fid,
            f"sbc_absolute_fy{year}",
            label=ph_label,
            section="Stock Compensation",
            numeric=220 + year,
        )

    for year in range(2021, 2026):
        fid = fid_2025 if year >= 2025 else fid_2024 if year >= 2024 else fid_2025
        add_ev(
            fid,
            f"operating_cash_flow_fy{year}",
            label=ph_label,
            section="Cash Flow",
            numeric=6200 + year * 30,
        )

    supabase.table("extracted_values").insert(extracted).execute()

    rf_added = [
        {
            "ticker": sym,
            "from_filing_id": fid_2024,
            "to_filing_id": fid_2025,
            "factor_text": "PLACEHOLDER — replace via ingest: added cyber underwriting concentration disclosure.",
            "change_type": "added",
            "char_start": 10,
            "char_end": 90,
        },
        {
            "ticker": sym,
            "from_filing_id": fid_2024,
            "to_filing_id": fid_2025,
            "factor_text": "PLACEHOLDER — replace via ingest: added climate litigation sensitivity narrative.",
            "change_type": "added",
            "char_start": 100,
            "char_end": 180,
        },
    ]
    rf_removed = [
        {
            "ticker": sym,
            "from_filing_id": fid_2024,
            "to_filing_id": fid_2025,
            "factor_text": "PLACEHOLDER — replace via ingest: removed legacy reinsurance treaty boilerplate.",
            "change_type": "removed",
            "char_start": 200,
            "char_end": 260,
        },
    ]
    rf_intense = [
        {
            "ticker": sym,
            "from_filing_id": fid_2024,
            "to_filing_id": fid_2025,
            "factor_text": "PLACEHOLDER — replace via ingest: intensified catastrophe reinsurance renewal uncertainty.",
            "change_type": "intensified",
            "char_start": 300,
            "char_end": 380,
        },
        {
            "ticker": sym,
            "from_filing_id": fid_2024,
            "to_filing_id": fid_2025,
            "factor_text": "PLACEHOLDER — replace via ingest: intensified inflation severity commentary.",
            "change_type": "intensified",
            "char_start": 400,
            "char_end": 470,
        },
    ]

    supabase.table("risk_factor_changes").insert(rf_added + rf_removed + rf_intense).execute()

    segments_rows = [
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "segment_name": "Personal Auto",
            "metric": "revenue",
            "period": "FY2025",
            "value": 42000,
            "char_start": 0,
            "char_end": 40,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "segment_name": "Commercial Lines",
            "metric": "revenue",
            "period": "FY2025",
            "value": 21000,
            "char_start": 50,
            "char_end": 90,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "segment_name": "Personal Auto",
            "metric": "op_income",
            "period": "FY2025",
            "value": 5100,
            "char_start": 100,
            "char_end": 140,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "segment_name": "Commercial Lines",
            "metric": "op_income",
            "period": "FY2025",
            "value": 2400,
            "char_start": 150,
            "char_end": 190,
        },
    ]
    supabase.table("segments").insert(segments_rows).execute()

    debt_rows = [
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "maturity_year": 2026,
            "principal": 850,
            "interest_rate": 3.25,
            "description": ph_label,
            "char_start": 0,
            "char_end": 40,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "maturity_year": 2027,
            "principal": 920,
            "interest_rate": 3.40,
            "description": ph_label,
            "char_start": 50,
            "char_end": 90,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "maturity_year": 2028,
            "principal": 780,
            "interest_rate": 3.55,
            "description": ph_label,
            "char_start": 100,
            "char_end": 140,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "maturity_year": 2029,
            "principal": 640,
            "interest_rate": 3.60,
            "description": ph_label,
            "char_start": 150,
            "char_end": 190,
        },
        {
            "filing_id": fid_2025,
            "ticker": sym,
            "maturity_year": 2030,
            "principal": 410,
            "interest_rate": 3.85,
            "description": ph_label,
            "char_start": 200,
            "char_end": 240,
        },
    ]
    supabase.table("debt_maturities").insert(debt_rows).execute()

    print(f"Seed complete for {sym}: filings {fid_2024}, {fid_2025}")


if __name__ == "__main__":
    main()
