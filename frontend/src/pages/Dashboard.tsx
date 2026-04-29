import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useAppShell } from "../AppContext";
import type { ExtractedValue, RiskFactorChange } from "../types";
import ClickableNumber from "../components/ui/ClickableNumber";
import DebtMaturityWall from "../components/panels/DebtMaturityWall";
import FCFvsNetIncome from "../components/panels/FCFvsNetIncome";
import FinancialTrend from "../components/panels/FinancialTrend";
import InsuranceOverlay from "../components/panels/InsuranceOverlay";
import SBCAsPercentOCF from "../components/panels/SBCAsPercentOCF";

type HeadlineMetric = {
  key: string;
  label: string;
  description: string;
  priorKey?: string;
};

const HEADLINE_METRICS: HeadlineMetric[] = [
  { key: "net_premiums_fy2025", label: "NET PREMIUMS FY2025", description: "Net premiums earned" },
  { key: "investment_income_fy2025", label: "INVESTMENT INCOME FY2025", description: "Investment income" },
  {
    key: "net_realized_gains_on_securities_fy2025",
    label: "NET REALIZED GAINS ON SECURITIES FY2025",
    description: "Net realized gains",
    priorKey: "net_realized_gains_on_securities_fy2024",
  },
  { key: "net_income_fy2025", label: "NET INCOME FY2025", description: "Net income" },
];

function numberOrPlaceholder(ev: ExtractedValue | undefined, loading: boolean): string {
  if (loading || !ev) return "—";
  if (ev.value_numeric != null) return ev.value_numeric.toLocaleString();
  if (ev.value_text) return ev.value_text;
  return "—";
}

function yoyDelta(
  current: ExtractedValue | undefined,
  prior: ExtractedValue | undefined,
  loading: boolean,
): number | null {
  if (loading || current?.value_numeric == null || prior?.value_numeric == null || prior.value_numeric === 0) {
    return null;
  }
  return ((current.value_numeric - prior.value_numeric) / prior.value_numeric) * 100;
}

function formatYoY(delta: number | null): string {
  if (delta == null) return "";
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${delta.toFixed(1)}% vs FY2024`;
}

function deltaColor(delta: number | null) {
  if (delta == null) return "text-preview-textDim";
  return delta >= 0 ? "text-cite-fcf" : "text-cite-risk";
}

function countByType(changes: RiskFactorChange[], type: RiskFactorChange["change_type"]) {
  return changes.filter((c) => c.change_type === type).length;
}

function RiskSummaryTiles({
  added,
  intensified,
  removed,
  compact = false,
  loading,
}: {
  added: number;
  intensified: number;
  removed: number;
  compact?: boolean;
  loading: boolean;
}) {
  const size = compact ? "24px" : "40px";
  const cells = [
    { label: "ADDED", value: added, sign: "+", color: "text-cite-fcf" },
    { label: "INTENSIFIED", value: intensified, sign: "Δ", color: "text-cite-debt" },
    { label: "REMOVED", value: removed, sign: "−", color: "text-cite-risk" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cells.map((cell) => (
        <article key={cell.label} className="border border-preview-chromeBorder bg-preview-chrome px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">{cell.label}</p>
          <p
            className={`mt-1 font-mono leading-none tabular-nums ${cell.color}`}
            style={{ fontSize: size }}
          >
            {loading ? "—" : `${cell.sign}${cell.value}`}
          </p>
        </article>
      ))}
    </div>
  );
}

function getValue(evMap: Record<string, ExtractedValue[]>, key: string): ExtractedValue | undefined {
  return evMap[key]?.[0];
}

export default function Dashboard() {
  const { data, loading, error } = useAppShell();
  const filing = data?.filing;
  const ev = data?.extracted_values ?? {};
  const risk = data?.risk_factor_changes ?? [];

  const addedCount = useMemo(() => countByType(risk, "added"), [risk]);
  const intensifiedCount = useMemo(() => countByType(risk, "intensified"), [risk]);
  const removedCount = useMemo(() => countByType(risk, "removed"), [risk]);
  const isLoading = loading || !data;

  return (
    <div className="px-8 py-6">
      {error && (
        <div className="mb-6 border-l-[3px] border-cite-risk bg-preview-chrome px-4 py-3 text-[13px] text-preview-text">
          Error loading data: {error}
        </div>
      )}

      <section className="grid min-h-[280px] gap-6">
        <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
          <div className="grid gap-6 sm:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="text-[24px] font-light leading-tight text-white">
                {isLoading ? "—" : `${filing?.ticker ?? "—"} — Filing Snapshot`}
              </p>
              <p className="mt-2 text-[13px] text-preview-textDim">Year-over-year change vs FY2024</p>
            </div>
            <div className="grid content-end gap-4">
              <RiskSummaryTiles
                added={addedCount}
                intensified={intensifiedCount}
                removed={removedCount}
                loading={isLoading}
              />
              <Link to="/risk-deltas" className="text-[12px] text-preview-accent hover:underline">
                VIEW ALL DELTAS →
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 border border-preview-chromeBorder bg-preview-chrome px-6 py-4">
        <div className="grid grid-cols-1 gap-6 text-[13px] text-preview-text sm:grid-cols-3 sm:divide-x sm:divide-preview-chromeBorder">
          <div>
            <span className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">CEO</span>
            <p className="mt-2 font-mono tabular-nums text-white">
              {isLoading || !ev.ceo?.[0] ? "—" : ev.ceo[0].value_text ?? "—"}
            </p>
          </div>
          <div className="sm:px-4">
            <span className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">CFO</span>
            <p className="mt-2 font-mono tabular-nums text-white">
              {isLoading || !ev.cfo?.[0] ? "—" : ev.cfo[0].value_text ?? "—"}
            </p>
          </div>
          <div className="sm:px-4">
            <span className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">Auditor</span>
            <p className="mt-2 font-mono tabular-nums text-white">
              {isLoading || !ev.auditor?.[0] ? "—" : ev.auditor[0].value_text ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 border border-preview-chromeBorder bg-preview-chrome p-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HEADLINE_METRICS.map((metric) => {
            const key = metric.key;
            const current = getValue(ev, key);
            const prior = getValue(ev, metric.priorKey ?? key.replace("fy2025", "fy2024"));
            const delta = yoyDelta(current, prior, isLoading);
            const showDelta = !isLoading && delta != null && prior != null;

            return (
              <article key={key} className="min-h-0">
                <p className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">{metric.label}</p>
                <p className="mt-3 font-mono text-[48px] tabular-nums leading-none text-white">
                  {current && !isLoading ? (
                    <ClickableNumber ev={current}>{numberOrPlaceholder(current, isLoading)}</ClickableNumber>
                  ) : (
                    numberOrPlaceholder(current, isLoading)
                  )}
                </p>
                {showDelta && <p className={`mt-2 text-[14px] tabular-nums ${deltaColor(delta)}`}>{formatYoY(delta)}</p>}
                <p className="mt-2 text-[11px] text-preview-textDim">{metric.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FinancialTrend extractedValues={ev} segments={data?.segments ?? []} loading={isLoading} />
        <DebtMaturityWall debts={data?.debt_maturities ?? []} loading={isLoading} />
        <FCFvsNetIncome extractedValues={ev} loading={isLoading} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <SBCAsPercentOCF extractedValues={ev} loading={isLoading} />
        <InsuranceOverlay extractedValues={ev} loading={isLoading} />
        <Link to="/risk-deltas" className="block border border-preview-chromeBorder bg-preview-chrome p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-light tracking-wide text-white">Risk summary capsule</h3>
            <span className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">Risk deltas</span>
          </div>
          <p className="text-[11px] text-preview-textDim">Navigate to all risk factor deltas</p>
          <div className="mt-4">
            <RiskSummaryTiles
              added={addedCount}
              intensified={intensifiedCount}
              removed={removedCount}
              compact
              loading={isLoading}
            />
          </div>
        </Link>
      </section>
    </div>
  );
}
