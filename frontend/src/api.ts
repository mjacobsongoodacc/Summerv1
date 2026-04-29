import type { DashboardPayload, FilingDetailResponse } from "./types";

const BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

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

export function analyzeTicker(ticker: string, industry: string): Promise<DashboardPayload> {
  const params = new URLSearchParams({ industry });
  return fetchJSON<DashboardPayload>(`/api/analyze/${encodeURIComponent(ticker)}?${params}`);
}

export function getFiling(filingId: string): Promise<FilingDetailResponse> {
  return fetchJSON<FilingDetailResponse>(`/api/filings/${encodeURIComponent(filingId)}`);
}
