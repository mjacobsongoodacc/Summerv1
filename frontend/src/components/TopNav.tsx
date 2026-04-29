import { NavLink } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAppShell } from "../AppContext";
import TickerInput from "./TickerInput";
import IndustryDropdown from "./IndustryDropdown";

function getFilingYear(periodEnd: string | undefined) {
  if (!periodEnd) return "—";
  const y = Number(new Date(periodEnd).getUTCFullYear());
  return Number.isFinite(y) ? `FY${y}` : "—";
}

function utcDayEquality(a: string, b: string) {
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

export default function TopNav() {
  const {
    ticker,
    setTicker,
    industry,
    setIndustry,
    data,
    viewedFiling,
    loading,
    ingesting,
    analyze,
    reIngest,
  } = useAppShell();
  const stripFiling = viewedFiling ?? data?.filing;
  const location = useLocation();
  const busy = loading || ingesting;

  const sourceRoute = (() => {
    if (location.pathname.startsWith("/source/")) return location.pathname;
    if (stripFiling?.id) return `/source/${stripFiling.id}`;
    return "/";
  })();

  const filingContext = useMemo(() => {
    const meta = viewedFiling ?? data?.filing ?? null;
    if (!meta || (!viewedFiling && (!data || loading))) {
      return "—";
    }

    const f = meta;
    const fy = getFilingYear(f.period_end_date);
    const base = `${f.ticker} · ${f.filing_type} · ${fy}`;

    const fd = f.filing_date;
    if (!fd || utcDayEquality(fd, f.period_end_date)) {
      return base;
    }

    const d = new Date(fd);
    if (Number.isNaN(d.getTime())) {
      return base;
    }

    const filedTxt = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);

    return `${base} · Filed ${filedTxt}`;
  }, [data, loading, viewedFiling]);

  return (
    <header className="sticky top-0 z-20 flex h-12 min-h-[48px] w-full flex-wrap items-stretch overflow-visible border-b border-preview-chromeBorder bg-preview-chrome text-[13px]">
      <div className="flex items-center px-4 font-sans">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-preview-textDim">CARNEGIE SCREENER</p>
      </div>
      <div className="ml-2 hidden items-center px-2 font-mono text-[12px] tabular-nums text-preview-text md:flex">
        {filingContext}
      </div>
      <nav className="ml-auto flex items-center divide-x divide-preview-chromeBorder border-x border-preview-chromeBorder font-sans">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `inline-flex h-12 items-center justify-center px-4 text-[14px] font-medium tracking-[0.04em] ${
              isActive
                ? "border-b-2 border-white text-white"
                : "text-preview-textDim hover:text-preview-text"
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to={sourceRoute}
          className={({ isActive }) =>
            `inline-flex h-12 items-center justify-center px-4 text-[14px] font-medium tracking-[0.04em] ${
              isActive
                ? "border-b-2 border-white text-white"
                : "text-preview-textDim hover:text-preview-text"
            }`
          }
        >
          Source
        </NavLink>
        <NavLink
          to="/risk-deltas"
          className={({ isActive }) =>
            `inline-flex h-12 items-center justify-center px-4 text-[14px] font-medium tracking-[0.04em] ${
              isActive
                ? "border-b-2 border-white text-white"
                : "text-preview-textDim hover:text-preview-text"
            }`
          }
        >
          Risk Deltas
        </NavLink>
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-preview-chromeBorder px-4 font-sans">
        <div className="relative pb-7">
          <div className="flex items-center gap-2">
            <TickerInput value={ticker} onChange={setTicker} />
            <IndustryDropdown value={industry} onChange={setIndustry} />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void analyze(ticker, industry);
              }}
              className="flex h-8 items-center gap-2 border border-preview-chromeBorder bg-preview-accent px-3 py-1 text-[13px] font-normal text-white disabled:pointer-events-none disabled:opacity-50"
              aria-label="Run analysis"
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              Analyze
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            className="absolute bottom-1 right-0 text-[10px] leading-none text-preview-textDim hover:text-preview-text disabled:opacity-50"
            onClick={() => {
              void reIngest();
            }}
          >
            Re-ingest
          </button>
        </div>
      </div>
    </header>
  );
}
