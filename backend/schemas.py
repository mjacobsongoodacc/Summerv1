from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class Filing(BaseModel):
    """Matches table `filings`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticker: str
    filing_type: str
    period_end_date: date
    accession_number: str
    source_url: str
    cleaned_html: str
    section_index: list[Any] = Field(default_factory=list)
    created_at: datetime | None = None


class ExtractedValue(BaseModel):
    """Matches table `extracted_values`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    ticker: str
    metric_key: str
    value_numeric: float | None = None
    value_text: str | None = None
    label: str
    section: str
    char_start: int
    char_end: int
    paragraph_text: str
    anchor_text: str | None = None
    anchor_hash: str | None = None
    display_label: str | None = None
    sub_state: str = "neutral"
    created_at: datetime | None = None


class RiskFactorChange(BaseModel):
    """Matches table `risk_factor_changes`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticker: str
    from_filing_id: UUID | None = None
    to_filing_id: UUID | None = None
    factor_text: str
    change_type: str
    char_start: int | None = None
    char_end: int | None = None
    anchor_text: str | None = None
    anchor_hash: str | None = None
    display_label: str | None = None
    sub_state: str = "neutral"
    created_at: datetime | None = None


class Segment(BaseModel):
    """Matches table `segments`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    ticker: str
    segment_name: str
    metric: str
    period: str
    value: float
    char_start: int | None = None
    char_end: int | None = None


class DebtMaturity(BaseModel):
    """Matches table `debt_maturities`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filing_id: UUID
    ticker: str
    maturity_year: int
    principal: float
    interest_rate: float | None = None
    description: str | None = None
    char_start: int | None = None
    char_end: int | None = None


class FilingMetadata(BaseModel):
    """Subset of filing fields for dashboard responses."""

    id: UUID
    ticker: str
    filing_type: str
    period_end_date: date
    filing_date: date
    accession_number: str
    source_url: str


class DashboardPayload(BaseModel):
    """Response for GET /api/analyze/{ticker}."""

    filing: FilingMetadata
    extracted_values: dict[str, list[ExtractedValue]] = Field(
        description="Metric key → rows for this ticker (newest filing first within each key)."
    )
    risk_factor_changes: list[RiskFactorChange]
    segments: list[Segment]
    debt_maturities: list[DebtMaturity]


class FilingDetailResponse(BaseModel):
    """Response for GET /api/filings/{filing_id}."""

    id: UUID
    ticker: str
    filing_type: str
    period_end_date: date
    filing_date: date
    source_url: str
    cleaned_html: str
    section_index: list[Any]
    extracted_values: list[ExtractedValue] = Field(default_factory=list)
    risk_factor_changes: list[RiskFactorChange] = Field(default_factory=list)
