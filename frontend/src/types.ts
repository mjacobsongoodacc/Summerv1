export type UUID = string;

export interface FilingMetadata {
  id: UUID;
  ticker: string;
  filing_type: string;
  period_end_date: string;
  /** Exact SEC filing date when provided by API; omit `"Filed …"` unless set and distinct from fiscal period-end. */
  filing_date?: string | null;
  accession_number: string;
  source_url: string;
}

export interface ExtractedValue {
  id: UUID;
  filing_id: UUID;
  ticker: string;
  metric_key: string;
  value_numeric: number | null;
  value_text: string | null;
  label: string;
  section: string;
  char_start: number;
  char_end: number;
  paragraph_text: string;
  anchor_text?: string | null;
  anchor_hash?: string | null;
  display_label?: string | null;
  sub_state?: string | null;
  created_at?: string | null;
}

export interface RiskFactorChange {
  id: UUID;
  ticker: string;
  from_filing_id: UUID | null;
  to_filing_id: UUID | null;
  factor_text: string;
  change_type: "added" | "removed" | "intensified" | "unchanged";
  char_start: number | null;
  char_end: number | null;
  anchor_text?: string | null;
  anchor_hash?: string | null;
  display_label?: string | null;
  sub_state?: string | null;
  created_at?: string | null;
}

export interface SegmentRow {
  id: UUID;
  filing_id: UUID;
  ticker: string;
  segment_name: string;
  metric: "revenue" | "op_income";
  period: string;
  value: number;
  char_start: number | null;
  char_end: number | null;
}

export interface DebtMaturityRow {
  id: UUID;
  filing_id: UUID;
  ticker: string;
  maturity_year: number;
  principal: number;
  interest_rate: number | null;
  description: string | null;
  char_start: number | null;
  char_end: number | null;
}

export interface DashboardPayload {
  filing: FilingMetadata;
  extracted_values: Record<string, ExtractedValue[]>;
  risk_factor_changes: RiskFactorChange[];
  segments: SegmentRow[];
  debt_maturities: DebtMaturityRow[];
}

export interface FilingDetailResponse {
  id: UUID;
  ticker: string;
  filing_type: string;
  period_end_date: string;
  filing_date?: string | null;
  source_url: string;
  cleaned_html: string;
  section_index: SectionIndexEntry[];
  extracted_values?: ExtractedValue[];
  risk_factor_changes?: RiskFactorChange[];
}

export interface SectionIndexEntry {
  name: string;
  anchor: string;
  char_start?: number;
  char_end?: number;
  id?: string;
}
