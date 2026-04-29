# Carnegie Screener

Single-user prototype for reviewing 10-K / 10-Q extracts: a FastAPI backend backed by Supabase, and a Vite + React dashboard. The EDGAR ingest pipeline is intentionally out of scope here.

## Prerequisites

- Python 3.10+
- Node 18+
- A Supabase project (run the SQL migration manually)

## Setup

1. **Database** — Open the Supabase SQL editor and execute `backend/migrations/001_initial_schema.sql`.

2. **Backend**

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   ```

   Populate `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service role only; suitable for this local prototype).

3. **Seed Progressive (PGR) hand data**

   ```bash
   python seed/seed_pgr.py
   ```

4. **Run API**

   ```bash
   uvicorn app:app --reload
   ```

5. **Frontend**

   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

6. Open **http://localhost:5173** (Vite dev server). The UI calls the API at `http://localhost:8000` by default; override with `VITE_API_BASE_URL` if needed.

## What ships in this scaffold

- REST endpoints for dashboard analysis (`GET /api/analyze/{ticker}`) and filing HTML (`GET /api/filings/{filing_id}`).
- Seeded Progressive rows for two fiscal 10-Ks, extracted metrics, placeholder risk-factor diffs, segment and debt tables.
- Dashboard panels (risk delta, trends, leverage wall, cash flow vs income, stock comp, insurance overlay) plus a macOS-inspired source viewer shell with zoom, sidebar thumbnails/contents, and citation highlights.

Ingest, cleaning, and diff generation are handled by a follow-on pipeline.
