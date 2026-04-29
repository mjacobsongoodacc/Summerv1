from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup, Tag

YEAR_RE = re.compile(r"\b(20\d{2})\b")
NUMBER_RE = re.compile(r"^\(?\s*\$?[\d,]+(?:\.\d+)?\s*\)?$")
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
    tables = [_parse_table(table) for table in soup.find_all("table")]
    premiums_table = _select_table(tables, ("premiums earned:", "property and liability insurance"))
    income_table = _select_table(tables, ("total revenues", "income before income taxes", "net income"))
    if not premiums_table or not income_table:
        return []

    values: list[dict[str, Any]] = []
    premium_values = _extract_premiums_by_year(premiums_table)
    revenue_row = _find_row(income_table, ("total revenues",))
    operating_row = _find_row(income_table, ("income before income taxes",))
    net_income_row = _find_row(income_table, ("net income",))

    for year in sorted(set(premium_values) | set(income_table.year_columns)):
        revenue = premium_values.get(year)
        if revenue is not None:
            values.append(
                _metric_from_text(
                    metric_key=f"net_premiums_fy{year}",
                    label=f"Net premiums earned FY{year}",
                    section="Item 15",
                    value_numeric=revenue,
                    paragraph_text=_premiums_paragraph_for_year(premiums_table, year),
                    cleaned_html=cleaned_html,
                    snippet=str(int(revenue)) if float(revenue).is_integer() else str(revenue),
                )
            )

        total_revenue = _row_year_value(revenue_row, income_table, year)
        operating = _row_year_value(operating_row, income_table, year)
        if operating is not None and total_revenue not in (None, 0):
            values.append(
                _metric_from_numeric(
                    year,
                    "operating_margin_fy",
                    "Operating margin",
                    "Item 15",
                    round((operating / total_revenue) * 100, 2),
                    cleaned_html,
                    income_table,
                    operating_row,
                )
            )
            values.append(
                _metric_from_numeric(
                    year,
                    "gross_margin_fy",
                    "Underwriting margin",
                    "Item 15",
                    round((operating / total_revenue) * 100, 2),
                    cleaned_html,
                    income_table,
                    operating_row,
                )
            )

        net_income = _row_year_value(net_income_row, income_table, year)
        if net_income is not None:
            values.append(
                _metric_from_row(
                    cleaned_html,
                    income_table,
                    net_income_row,
                    year,
                    "net_income_fy",
                    "Net income",
                    "Item 15",
                    net_income,
                )
            )

    return values


def extract_segments(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    tables = [_parse_table(table) for table in soup.find_all("table")]
    revenue_table = _select_table(tables, ("supplementary insurance information", "net premiums written", "segment"))
    profit_table = _select_table(tables, ("pretax underwriting profit", "total underwriting revenue", "personal lines", "commercial lines"))
    if not revenue_table:
        return []

    segments: list[dict[str, Any]] = []
    capture = False
    for row_index, row in enumerate(revenue_table.rows):
        if row and row[0].startswith("Year ended December 31, 2025"):
            capture = True
            continue
        if capture and row and row[0].startswith("Year ended December 31, 2024"):
            break
        if not capture or not row:
            continue
        label = row[0]
        if label.lower() in {"total", "segment"}:
            continue
        numeric_texts = [cell for cell in row[1:] if NUMBER_RE.match(cell.strip())]
        if not numeric_texts:
            continue
        value = _parse_number(numeric_texts[-1], revenue_table.unit_scale_to_millions)
        if value is None:
            continue
        char_start, char_end = _locate_row(cleaned_html, revenue_table.row_html[row_index], numeric_texts[-1])
        segments.append(
            {
                "segment_name": label,
                "metric": "revenue",
                "period": "FY2025",
                "value": value,
                "char_start": char_start,
                "char_end": char_end,
            }
        )

    if profit_table:
        header = profit_table.rows[0] if profit_table.rows else []
        segment_names = [name.replace(" 1", "").strip() for name in header[1:4]]
        profit_row_ref = _find_row(profit_table, ("pretax underwriting profit (loss)",))
        if profit_row_ref:
            row_index, row = profit_row_ref
            numeric_texts = [cell for cell in row[1:] if NUMBER_RE.match(cell.strip())]
            for segment_name, numeric_text in zip(segment_names, numeric_texts[: len(segment_names)], strict=False):
                value = _parse_number(numeric_text, profit_table.unit_scale_to_millions)
                if value is None:
                    continue
                char_start, char_end = _locate_row(cleaned_html, profit_table.row_html[row_index], numeric_text)
                segments.append(
                    {
                        "segment_name": segment_name,
                        "metric": "op_income",
                        "period": "FY2025",
                        "value": value,
                        "char_start": char_start,
                        "char_end": char_end,
                    }
                )
    return segments


def extract_debt_maturities(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    maturities: list[dict[str, Any]] = []
    pattern = re.compile(
        r"Form(?: of)? ([\d. ]+)% Senior Note(?:s)? due (\d{4}), issued in the aggregate principal amount of \$([\d,]+)",
        re.IGNORECASE,
    )
    for match in pattern.finditer(cleaned_html):
        rate_text, maturity_year, principal_text = match.groups()
        rate = float(rate_text.replace(" ", ""))
        principal = round(float(principal_text.replace(",", "")) / 1_000_000, 3)
        maturities.append(
            {
                "maturity_year": int(maturity_year),
                "principal": principal,
                "interest_rate": rate,
                "description": match.group(0),
                "char_start": match.start(),
                "char_end": match.end(),
            }
        )
    return maturities


def extract_capital_metrics(cleaned_html: str, section_index: list[dict]) -> list[dict[str, Any]]:
    soup = BeautifulSoup(cleaned_html, "lxml")
    tables = [_parse_table(table) for table in soup.find_all("table")]
    cash_flow_table = _select_table(
        tables,
        (
            "net cash provided by operating activities",
            "cash flows from operating activities",
            "amortization of equity-based compensation",
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
    sbc_row = _find_row(
        cash_flow_table,
        (
            "stock-based compensation",
            "share-based compensation",
            "equity-based compensation",
        ),
    )
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
        if ocf is not None:
            fcf = ocf - abs(capex) if capex is not None else ocf
            values.append(
                _metric_from_row(
                    cleaned_html,
                    cash_flow_table,
                    capex_row or ocf_row,
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
    number_text = _row_year_text(row, table, year)
    if number_text is None:
        raise ValueError(f"Missing year text for {prefix}{year}")
    char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], number_text)
    slice_html = cleaned_html[char_start:char_end]
    plain_para = _plain_visible(slice_html) if slice_html.strip() else " | ".join(row)
    return {
        "metric_key": f"{prefix}{year}",
        "value_numeric": value,
        "value_text": None,
        "label": f"{label} FY{year}",
        "section": section,
        "char_start": char_start,
        "char_end": char_end,
        "paragraph_text": plain_para,
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
    number_text = _row_year_text(row, table, year)
    if number_text is None:
        raise ValueError(f"Missing year text for {prefix}{year}")
    char_start, char_end = _locate_row(cleaned_html, table.row_html[row_index], number_text)
    slice_html = cleaned_html[char_start:char_end]
    plain_para = _plain_visible(slice_html) if slice_html.strip() else " | ".join(row)
    return {
        "metric_key": f"{prefix}{year}",
        "value_numeric": value,
        "value_text": None,
        "label": f"{label} FY{year}",
        "section": section,
        "char_start": char_start,
        "char_end": char_end,
        "paragraph_text": plain_para,
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
    for header_row in rows[:4]:
        for index, cell in enumerate(header_row):
            match = YEAR_RE.search(cell)
            if match:
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
    normalized_patterns = tuple(pattern.lower() for pattern in patterns)
    for index, row in enumerate(table.rows):
        label = row[0].lower()
        if any(label == pattern for pattern in normalized_patterns):
            return index, row
    for index, row in enumerate(table.rows):
        label = row[0].lower()
        if any(pattern in label for pattern in normalized_patterns):
            return index, row
    return None


def _row_year_value(row_ref: tuple[int, list[str]] | None, table: ParsedTable, year: int) -> float | None:
    if row_ref is None:
        return None
    _, row = row_ref
    number_text = _row_year_text(row, table, year)
    if number_text is None:
        return None
    return _parse_number(number_text, table.unit_scale_to_millions)


def _parse_number(value: str, scale_to_millions: float) -> float | None:
    text = value.strip()
    if not NUMBER_RE.match(text):
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("() ").replace("$", "").replace(",", "")
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


def _plain_visible(html_fragment: str) -> str:
    fragment = html_fragment.strip()
    if not fragment or "<" not in fragment:
        return fragment
    soup = BeautifulSoup(fragment, "lxml")
    return soup.get_text(" ", strip=True)


def _ordered_years(table: ParsedTable) -> list[int]:
    return sorted(table.year_columns, reverse=True)


def _row_year_text(row: list[str], table: ParsedTable, year: int) -> str | None:
    years = _ordered_years(table)
    if year not in years:
        return None
    numeric_texts = [cell for cell in row[1:] if NUMBER_RE.match(cell.strip())]
    if len(numeric_texts) < len(years):
        numeric_texts = [cell for cell in row if NUMBER_RE.match(cell.strip())]
    year_to_text = dict(zip(years, numeric_texts, strict=False))
    return year_to_text.get(year)


def _extract_premiums_by_year(table: ParsedTable) -> dict[int, float]:
    result: dict[int, float] = {}
    current_year: int | None = None
    for row in table.rows:
        if not row:
            continue
        year_match = re.search(r"December 31,\s*(\d{4})", row[0])
        if year_match:
            current_year = int(year_match.group(1))
            continue
        if current_year and row[0].lower() == "property and liability insurance":
            numeric_cells = [_parse_number(cell, table.unit_scale_to_millions) for cell in row[1:]]
            numeric_cells = [cell for cell in numeric_cells if cell is not None]
            if numeric_cells:
                result[current_year] = numeric_cells[-2] if len(numeric_cells) >= 2 else numeric_cells[-1]
    return result


def _premiums_paragraph_for_year(table: ParsedTable, year: int) -> str:
    capture = []
    current_year: int | None = None
    for row in table.rows:
        if not row:
            continue
        year_match = re.search(r"December 31,\s*(\d{4})", row[0])
        if year_match:
            current_year = int(year_match.group(1))
            capture = [row[0]]
            continue
        if current_year == year:
            capture.append(" | ".join(row))
            if row[0].lower() == "property and liability insurance":
                return " | ".join(capture)
    return f"Premiums earned FY{year}"


def _metric_from_text(
    *,
    metric_key: str,
    label: str,
    section: str,
    value_numeric: float,
    paragraph_text: str,
    cleaned_html: str,
    snippet: str,
) -> dict[str, Any]:
    start = cleaned_html.find(snippet)
    if start < 0:
        start = cleaned_html.find(paragraph_text[:80]) if paragraph_text else -1
    if start < 0:
        start = 0
    end = start + len(snippet) if snippet else max(1, start + 1)
    slice_html = cleaned_html[start:end]
    plain = _plain_visible(slice_html) if slice_html.strip() else paragraph_text
    return {
        "metric_key": metric_key,
        "value_numeric": value_numeric,
        "value_text": None,
        "label": label,
        "section": section,
        "char_start": max(0, start),
        "char_end": max(max(0, start) + 1, end),
        "paragraph_text": plain,
    }
