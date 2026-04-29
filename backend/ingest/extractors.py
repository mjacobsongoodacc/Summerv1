from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup, Tag

YEAR_RE = re.compile(r"\b(20\d{2})\b")
NUMBER_RE = re.compile(r"^\(?\$?[\d,]+(?:\.\d+)?\)?$")
PERCENT_RE = re.compile(r"(\d+(?:\.\d+)?)%")


@dataclass
class ParsedTable:
    table: Tag
    rows: list[list[str]]
    row_html: list[str]
    unit_scale_to_millions: float
    year_columns: dict[int, int]


def extract_financial_trends(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    item8_anchor = _find_section_anchor(section_index, ("item 8", "financial statements"))
    tables = _tables_in_section(soup, item8_anchor)
    table = _select_table(tables, ("net premiums earned", "total revenues", "revenues"))
    if not table:
        return []

    current_year = max(table.year_columns) if table.year_columns else None
    if current_year is None:
        return []

    revenue_row = _find_row(table, ("net premiums earned", "total revenues", "revenues"))
    underwriting_profit_row = _find_row(table, ("underwriting profit", "gross profit"))
    operating_row = _find_row(
        table,
        (
            "income before income taxes",
            "pretax income",
            "operating income",
            "income from operations",
        ),
    )
    net_income_row = _find_row(table, ("net income",))

    values: list[dict[str, Any]] = []
    for year in sorted(table.year_columns):
        revenue = _row_year_value(revenue_row, table, year)
        if revenue is not None:
            values.append(_metric_from_row(cleaned_html, table, revenue_row, year, "net_premiums_fy", "Net premiums earned", "Item 8", revenue))

        numerator = _row_year_value(underwriting_profit_row, table, year)
        if numerator is not None and revenue not in (None, 0):
            values.append(
                _metric_from_numeric(
                    year,
                    "gross_margin_fy",
                    "Underwriting margin",
                    "Item 8",
                    round((numerator / revenue) * 100, 2),
                    cleaned_html,
                    table,
                    underwriting_profit_row,
                )
            )

        operating = _row_year_value(operating_row, table, year)
        if operating is not None and revenue not in (None, 0):
            values.append(
                _metric_from_numeric(
                    year,
                    "operating_margin_fy",
                    "Operating margin",
                    "Item 8",
                    round((operating / revenue) * 100, 2),
                    cleaned_html,
                    table,
                    operating_row,
                )
            )

        net_income = _row_year_value(net_income_row, table, year)
        if net_income is not None:
            values.append(_metric_from_row(cleaned_html, table, net_income_row, year, "net_income_fy", "Net income", "Item 8", net_income))

    return values


def extract_segments(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    tables = list(_tables_with_context(soup, ("segment information", "operating segments", "segments")))
    if not tables:
        return []

    table = _select_table(tables, ("pretax", "income before income taxes", "revenues", "net premiums"))
    if not table or not table.year_columns:
        return []

    current_year = max(table.year_columns)
    segments: list[dict[str, Any]] = []

    for row_index, row in enumerate(table.rows):
        if not row:
            continue
        label = row[0].strip()
        lowered = label.lower()
        if not label or YEAR_RE.search(label) or "total" in lowered or lowered in {"revenues", "pretax income"}:
            continue

        revenue = _row_year_value((row_index, row), table, current_year)
        if revenue is None:
            continue

        char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], row[1] if len(row) > 1 else label)
        segments.append(
            {
                "segment_name": label,
                "metric": "revenue",
                "period": f"FY{current_year}",
                "value": revenue,
                "char_start": char_start,
                "char_end": char_end,
            }
        )

    op_table = _select_table(tables, ("pretax", "income before income taxes", "operating income"))
    if op_table and op_table.year_columns:
        current_year = max(op_table.year_columns)
        for row_index, row in enumerate(op_table.rows):
            if not row:
                continue
            label = row[0].strip()
            lowered = label.lower()
            if not label or YEAR_RE.search(label) or "total" in lowered or "income" in lowered and lowered == "income before income taxes":
                continue
            op_income = _row_year_value((row_index, row), op_table, current_year)
            if op_income is None:
                continue
            char_start, char_end = _locate_row(cleaned_html, op_table.row_html[row_index], row[1] if len(row) > 1 else label)
            segments.append(
                {
                    "segment_name": label,
                    "metric": "op_income",
                    "period": f"FY{current_year}",
                    "value": op_income,
                    "char_start": char_start,
                    "char_end": char_end,
                }
            )

    return segments


def extract_debt_maturities(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    tables = list(_tables_with_context(soup, ("debt", "long-term debt", "maturities")))
    table = _select_table(tables, ("2026", "2027", "2028", "2029", "2030"))
    if not table:
        return []

    maturities: list[dict[str, Any]] = []
    for row_index, row in enumerate(table.rows):
        if len(row) < 2:
            continue
        year_match = YEAR_RE.search(row[0])
        if not year_match:
            continue
        principal = _parse_number(row[1], table.unit_scale_to_millions)
        if principal is None:
            continue
        rate = None
        rate_match = PERCENT_RE.search(" ".join(row))
        if rate_match:
            rate = float(rate_match.group(1))
        char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], row[1])
        maturities.append(
            {
                "maturity_year": int(year_match.group(1)),
                "principal": principal,
                "interest_rate": rate,
                "description": row[0],
                "char_start": char_start,
                "char_end": char_end,
            }
        )
    return maturities


def extract_capital_metrics(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    item8_anchor = _find_section_anchor(section_index, ("item 8", "financial statements"))
    tables = _tables_in_section(soup, item8_anchor)
    cash_flow_table = _select_table(
        tables,
        (
            "net cash provided by operating activities",
            "cash flows from operating activities",
        ),
    )
    if not cash_flow_table:
        return []

    ocf_row = _find_row(cash_flow_table, ("net cash provided by operating activities",))
    capex_row = _find_row(
        cash_flow_table,
        (
            "purchases of fixed assets",
            "capital expenditures",
            "purchase of property and equipment",
            "additions to property and equipment",
        ),
    )
    sbc_row = _find_row(cash_flow_table, ("stock-based compensation", "share-based compensation"))
    net_income_row = _find_row(cash_flow_table, ("net income",))

    values: list[dict[str, Any]] = []
    for year in sorted(cash_flow_table.year_columns):
        ocf = _row_year_value(ocf_row, cash_flow_table, year)
        capex = _row_year_value(capex_row, cash_flow_table, year)
        sbc = _row_year_value(sbc_row, cash_flow_table, year)
        net_income = _row_year_value(net_income_row, cash_flow_table, year)

        if ocf is not None:
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    ocf_row,
                    year,
                    "operating_cash_flow_fy",
                    "Operating cash flow",
                    "Cash Flow",
                    ocf,
                )
            )
        if net_income is not None:
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    net_income_row,
                    year,
                    "net_income_fy",
                    "Net income",
                    "Cash Flow",
                    net_income,
                )
            )
        if sbc is not None:
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    sbc_row,
                    year,
                    "sbc_absolute_fy",
                    "Stock-based compensation",
                    "Cash Flow",
                    sbc,
                )
            )
        if ocf is not None and capex is not None:
            fcf = ocf - abs(capex)
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    capex_row,
                    year,
                    "free_cash_flow_fy",
                    "Free cash flow",
                    "Cash Flow",
                    round(fcf, 3),
                )
            )
        if ocf not in (None, 0) and sbc is not None:
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    sbc_row,
                    year,
                    "sbc_pct_ocf_fy",
                    "SBC as % of OCF",
                    "Cash Flow",
                    round((sbc / ocf) * 100, 2),
                )
            )
    return values


def _metric_from_row(
    cleaned_html: str,
    table: ParsedTable,
    row_ref: tuple[int, list[str]] | None,
    year: int,
    prefix: str,
    label: str,
    section: str,
    value: float,
) -> dict[str, Any]:
    if row_ref is None:
        raise ValueError(f"Missing row for {prefix}{year}")
    row_index, row = row_ref
    number_text = row[table.year_columns[year]]
    char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], number_text)
    return {
        "metric_key": f"{prefix}{year}",
        "value_numeric": value,
        "value_text": None,
        "label": f"{label} FY{year}",
        "section": section,
        "char_start": char_start,
        "char_end": char_end,
        "paragraph_text": " | ".join(row),
    }


def _metric_from_numeric(
    year: int,
    prefix: str,
    label: str,
    section: str,
    value: float,
    cleaned_html: str,
    table: ParsedTable,
    row_ref: tuple[int, list[str]] | None,
) -> dict[str, Any]:
    if row_ref is None:
        raise ValueError(f"Missing row for {prefix}{year}")
    row_index, row = row_ref
    number_text = row[table.year_columns[year]]
    char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], number_text)
    return {
        "metric_key": f"{prefix}{year}",
        "value_numeric": value,
        "value_text": None,
        "label": f"{label} FY{year}",
        "section": section,
        "char_start": char_start,
        "char_end": char_end,
        "paragraph_text": " | ".join(row),
    }


def _find_section_anchor(section_index: list[dict], keywords: tuple[str, ...]) -> str | None:
    for section in section_index:
        name = str(section.get("name", "")).lower()
        if any(keyword in name for keyword in keywords):
            return section.get("anchor")
    return None


def _tables_in_section(soup: BeautifulSoup, anchor: str | None) -> list[ParsedTable]:
    if not anchor:
        return [_parse_table(table) for table in soup.find_all("table")]
    heading = soup.find(id=anchor)
    if not isinstance(heading, Tag):
        return [_parse_table(table) for table in soup.find_all("table")]
    tables = []
    for sibling in heading.find_next_siblings():
        if sibling.name in {"h1", "h2", "h3", "h4"} and sibling.get("id"):
            break
        if sibling.name == "table":
            tables.append(_parse_table(sibling))
    return tables


def _tables_with_context(soup: BeautifulSoup, keywords: tuple[str, ...]) -> list[ParsedTable]:
    matches = []
    for table in soup.find_all("table"):
        context = " ".join(
            _normalize_text(node.get_text(" ", strip=True))
            for node in [table.find_previous_sibling("h2"), table.find_previous_sibling("h3"), table.find_previous_sibling("p"), table]
            if isinstance(node, Tag)
        ).lower()
        if any(keyword in context for keyword in keywords):
            matches.append(_parse_table(table))
    return matches


def _select_table(tables: list[ParsedTable], keywords: tuple[str, ...]) -> ParsedTable | None:
    best = None
    best_score = -1
    for table in tables:
        haystack = " ".join(" ".join(row) for row in table.rows).lower()
        score = sum(keyword in haystack for keyword in keywords)
        if score > best_score:
            best = table
            best_score = score
    return best if best_score > 0 else None


def _parse_table(table: Tag) -> ParsedTable:
    rows: list[list[str]] = []
    row_html: list[str] = []
    context_bits = [table.get_text(" ", strip=True)]
    for sibling in table.find_previous_siblings(["p", "h2", "h3"], limit=2):
        context_bits.append(sibling.get_text(" ", strip=True))
    scale = _unit_scale(" ".join(context_bits))

    for row in table.find_all("tr"):
        cells = [_normalize_text(cell.get_text(" ", strip=True)) for cell in row.find_all("td")]
        cells = [cell for cell in cells if cell]
        if cells:
            rows.append(cells)
            row_html.append(str(row))

    year_columns: dict[int, int] = {}
    for header_row in rows[:3]:
        for index, cell in enumerate(header_row):
            match = YEAR_RE.search(cell)
            if match and index > 0:
                year_columns[int(match.group(1))] = index
        if year_columns:
            break

    return ParsedTable(
        table=table,
        rows=rows,
        row_html=row_html,
        unit_scale_to_millions=scale,
        year_columns=year_columns,
    )


def _find_row(table: ParsedTable, patterns: tuple[str, ...]) -> tuple[int, list[str]] | None:
    for index, row in enumerate(table.rows):
        label = row[0].lower()
        if any(pattern in label for pattern in patterns):
            return index, row
    return None


def _row_year_value(row_ref: tuple[int, list[str]] | None, table: ParsedTable, year: int) -> float | None:
    if row_ref is None or year not in table.year_columns:
        return None
    _, row = row_ref
    col_index = table.year_columns[year]
    if col_index >= len(row):
        return None
    return _parse_number(row[col_index], table.unit_scale_to_millions)


def _parse_number(value: str, scale_to_millions: float) -> float | None:
    text = value.strip()
    if not NUMBER_RE.match(text):
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()").replace("$", "").replace(",", "")
    number = float(text)
    if negative:
        number *= -1
    return round(number * scale_to_millions, 3)


def _unit_scale(context: str) -> float:
    lowered = context.lower()
    if "in billions" in lowered:
        return 1000.0
    if "in thousands" in lowered or "amounts in thousands" in lowered:
        return 0.001
    return 1.0


def _locate_row(cleaned_html: str, row_html: str, number_text: str) -> tuple[int, int]:
    row_index = cleaned_html.find(row_html)
    if row_index >= 0:
        number_index = row_html.find(number_text)
        if number_index >= 0:
            start = row_index + number_index
            return start, start + len(number_text)
    fallback = cleaned_html.find(number_text)
    if fallback >= 0:
        return fallback, fallback + len(number_text)
    return 0, max(1, len(number_text))


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
