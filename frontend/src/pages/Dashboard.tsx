import { useCallback, useEffect, useState } from "react";
import { BarChart3, Info, Loader2 } from "lucide-react";
import { analyzeTicker } from "../api";
import type { DashboardPayload, ExtractedValue } from "../types";
import IndustryDropdown, { type Industry } from "../components/IndustryDropdown";
import TickerInput from "../components/TickerInput";
import DebtMaturityWall from "../components/panels/DebtMaturityWall";
import FCFvsNetIncome from "../components/panels/FCFvsNetIncome";
import FinancialTrend from "../components/panels/FinancialTrend";
import InsuranceOverlay from "../components/panels/InsuranceOverlay";
import RiskFactorsDiff from "../components/panels/RiskFactorsDiff";
import SBCAsPercentOCF from "../components/panels/SBCAsPercentOCF";
import ClickableNumber from "../components/ui/ClickableNumber";

const headlineKeys = [
  ["net_premiums_fy2025", "Net premiums (FY2025)"],
  ["investment_income_fy2025", "Investment income (FY2025)"],
  ["net_realized_gains_securities_fy2025", "Realized gains on securities"],
  ["board_share_repurchase_authorization", "Repurchase plan"],
] as const;

export default function Dashboard() {
  const [ticker, setTicker] = useState("PGR");
  const [industry, setIndustry] = useState<Industry>("Insurance");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeTicker(ticker.trim() || "PGR", industry);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [ticker, industry]);

  useEffect(() => {
    void run();
    // Initial load only; further runs use Analyze button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ev = data?.extracted_values ?? {};

  const metric = (key: string): ExtractedValue | undefined => ev[key]?.[0];

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-gray-900">
      <header className="mx-auto mb-10 max-w-6xl border-b border-gray-200 pb-8">
        <p className="text-xs font-normal uppercase tracking-[0.2em] text-gray-500">Carnegie Screener</p>
        <h1 className="mt-2 text-3xl font-light tracking-tight text-carnegie-navy">Filing dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm font-normal leading-relaxed text-gray-600">
          Prototype view of insurer and capital metrics pulled from recent 10-K extracts. Figures link to cited
          paragraphs in the source viewer.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <TickerInput value={ticker} onChange={setTicker} />
          <IndustryDropdown value={industry} onChange={setIndustry} />
          <button
            type="button"
            onClick={() => void run()}
            className="inline-flex items-center gap-2 rounded-md border border-carnegie-navy bg-carnegie-navy px-5 py-2 text-sm font-normal text-white shadow-sm hover:bg-[#142a49]"
          >
            <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Analyze
          </button>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" strokeWidth={1.75} aria-label="Loading" />
          )}
        </div>
        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
        )}
      </header>

      {data && (
        <>
          <section className="mx-auto mb-10 max-w-6xl rounded-lg border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-xs font-normal uppercase tracking-wide text-gray-500">Headline metrics</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {headlineKeys.map(([key, label]) => {
                const row = metric(key);
                if (!row) {
                  return (
                    <div key={key}>
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
                      <div className="mt-1 font-mono text-sm text-gray-400">—</div>
                    </div>
                  );
                }
                const display =
                  row.value_numeric != null
                    ? row.value_numeric.toLocaleString()
                    : row.value_text ?? "—";
                return (
                  <div key={key}>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
                    <div className="mt-1 font-mono text-sm tabular-nums text-gray-900">
                      <ClickableNumber ev={row}>{display}</ClickableNumber>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3">
              {["ceo", "cfo", "auditor"].map((key) => {
                const row = metric(key);
                if (!row) return null;
                return (
                  <div key={key}>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">{key.toUpperCase()}</div>
                    <div className="mt-1 text-sm text-gray-900">
                      <ClickableNumber ev={row}>{row.value_text ?? "—"}</ClickableNumber>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
            <RiskFactorsDiff changes={data.risk_factor_changes} />
            <FinancialTrend extractedValues={ev} segments={data.segments} />
            <DebtMaturityWall debts={data.debt_maturities} />
            <FCFvsNetIncome extractedValues={ev} />
            <SBCAsPercentOCF extractedValues={ev} />
            {industry === "Insurance" ? <InsuranceOverlay extractedValues={ev} /> : <PlaceholderPanel />}
          </section>
        </>
      )}
    </div>
  );
}

function PlaceholderPanel() {
  return (
    <div className="flex gap-3 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden />
      <p>Insurance overlay hidden for non-insurance industries in this prototype.</p>
    </div>
  );
}
