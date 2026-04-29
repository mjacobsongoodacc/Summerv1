create table filings (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  filing_type text not null check (filing_type in ('10-K','10-Q')),
  period_end_date date not null,
  accession_number text unique not null,
  source_url text not null,
  cleaned_html text not null,
  section_index jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create index on filings (ticker, period_end_date desc);

create table extracted_values (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid references filings(id) on delete cascade,
  ticker text not null,
  metric_key text not null,
  value_numeric numeric,
  value_text text,
  label text not null,
  section text not null,
  char_start integer not null,
  char_end integer not null,
  paragraph_text text not null,
  created_at timestamptz default now()
);
create index on extracted_values (ticker, metric_key);

create table risk_factor_changes (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  from_filing_id uuid references filings(id),
  to_filing_id uuid references filings(id),
  factor_text text not null,
  change_type text not null check (change_type in ('added','removed','intensified','unchanged')),
  char_start integer,
  char_end integer,
  created_at timestamptz default now()
);
create index on risk_factor_changes (ticker, change_type);

create table segments (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid references filings(id) on delete cascade,
  ticker text not null,
  segment_name text not null,
  metric text not null check (metric in ('revenue','op_income')),
  period text not null,
  value numeric not null,
  char_start integer,
  char_end integer
);
create index on segments (ticker, segment_name);

create table debt_maturities (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid references filings(id) on delete cascade,
  ticker text not null,
  maturity_year integer not null,
  principal numeric not null,
  interest_rate numeric,
  description text,
  char_start integer,
  char_end integer
);
create index on debt_maturities (ticker, maturity_year);
