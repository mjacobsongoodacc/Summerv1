import type { DashboardPayload, FilingDetailResponse } from "./types";

/** In dev, same-origin + Vite proxy to FastAPI (:8000). Set VITE_API_BASE_URL when the UI is hosted separately from the API. */
function apiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
  if (env) return env;
  return import.meta.env.DEV ? "" : "http://localhost:8000";
}

const BASE = apiBase();

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function parseErrorDetail(res: Response): Promise<string> {
  let raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: string | unknown };
    if (j?.detail != null) return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
  } catch {
    /* keep raw text */
  }
  return raw || `${res.status} ${res.statusText}`;
}

export type AnalyzeTickerResult =
  | { ok: true; payload: DashboardPayload }
  | { ok: false; status: number; message: string };

export async function fetchAnalyzeTickerRaw(ticker: string, industry: string): Promise<AnalyzeTickerResult> {
  const params = new URLSearchParams({ industry });
  const res = await fetch(
    `${BASE}/api/analyze/${encodeURIComponent(ticker)}?${params}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (res.ok) {
    const payload = (await res.json()) as DashboardPayload;
    return { ok: true, payload };
  }
  const message = await parseErrorDetail(res);
  return { ok: false, status: res.status, message };
}

export function analyzeTicker(ticker: string, industry: string): Promise<DashboardPayload> {
  const params = new URLSearchParams({ industry });
  return fetchJSON<DashboardPayload>(`/api/analyze/${encodeURIComponent(ticker)}?${params}`);
}

export function getFiling(filingId: string): Promise<FilingDetailResponse> {
  return fetchJSON<FilingDetailResponse>(`/api/filings/${encodeURIComponent(filingId)}`);
}

export type IngestTickerResult =
  | { ok: true; filings_inserted: number; values_inserted: number; raw?: Record<string, unknown> }
  | { ok: false; error: string };

export async function ingestTicker(ticker: string): Promise<IngestTickerResult> {
  const res = await fetch(`${BASE}/api/ingest/${encodeURIComponent(ticker)}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let rawUnknown: Record<string, unknown> = {};
  if (text) {
    try {
      const j = JSON.parse(text) as unknown;
      rawUnknown = j && typeof j === "object" ? (j as Record<string, unknown>) : {};
    } catch {
      if (!res.ok) return { ok: false, error: text || `${res.status} ${res.statusText}` };
      return { ok: false, error: "Invalid JSON response from ingest endpoint" };
    }
  }

  const filingsInserted = typeof rawUnknown["filings_inserted"] === "number" ? rawUnknown["filings_inserted"] : 0;
  const valuesInserted = typeof rawUnknown["values_inserted"] === "number" ? rawUnknown["values_inserted"] : 0;

  if (!res.ok) {
    const detail =
      typeof rawUnknown.detail === "string"
        ? rawUnknown.detail
        : typeof rawUnknown.detail === "object" && rawUnknown.detail != null
          ? JSON.stringify(rawUnknown.detail)
          : text || `${res.status} ${res.statusText}`;
    return { ok: false, error: detail };
  }

  return { ok: true, filings_inserted: filingsInserted, values_inserted: valuesInserted, raw: rawUnknown };
}

export async function loadDashboardWithIngestFallback(
  ticker: string,
  industry: string,
  onProgress?: (msg: string | null) => void,
): Promise<DashboardPayload> {
  const sym = ticker.trim().toUpperCase();
  let r = await fetchAnalyzeTickerRaw(sym, industry);
  if (r.ok) return r.payload;
  if (r.status !== 404) throw new Error(r.message);

  onProgress?.(`Ingesting ${sym} from SEC EDGAR…`);
  const ig = await ingestTicker(sym);
  if (!ig.ok) throw new Error(ig.error);

  onProgress?.("Pulling 10-K from SEC… extracting financials… computing risk diff…");
  r = await fetchAnalyzeTickerRaw(sym, industry);
  if (!r.ok) throw new Error(r.message);
  return r.payload;
}

export async function reIngestAndLoadDashboard(
  ticker: string,
  industry: string,
  onProgress?: (msg: string | null) => void,
): Promise<DashboardPayload> {
  const sym = ticker.trim().toUpperCase();
  onProgress?.(`Re-ingesting ${sym}…`);
  const ig = await ingestTicker(sym);
  if (!ig.ok) throw new Error(ig.error);

  onProgress?.("Pulling 10-K from SEC… extracting financials… computing risk diff…");
  const r = await fetchAnalyzeTickerRaw(sym, industry);
  if (!r.ok) throw new Error(r.message);
  return r.payload;
}
