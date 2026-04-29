import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getFiling, loadDashboardWithIngestFallback } from "../api";
import type { DashboardPayload, FilingDetailResponse, SectionIndexEntry, ExtractedValue, FilingMetadata } from "../types";
import Toolbar from "../components/sourceviewer/Toolbar";
import Sidebar from "../components/sourceviewer/Sidebar";
import DocumentView, { type DocCitation } from "../components/sourceviewer/DocumentView";
import { DEFAULT_FILTER_ENABLED, metricKeyToClass, type CiteCategory } from "../lib/citationColors";
import { useAppShell } from "../AppContext";

function filingDetailToStripMeta(f: FilingDetailResponse): FilingMetadata {
  return {
    id: f.id,
    ticker: f.ticker,
    filing_type: f.filing_type,
    period_end_date: f.period_end_date,
    filing_date: f.filing_date ?? null,
    accession_number: "",
    source_url: f.source_url,
  };
}

function formatValueForCitation(ev: ExtractedValue): string {
  if (ev.value_numeric != null) {
    return `${ev.value_numeric}`;
  }
  return ev.value_text ?? "";
}

function buildDocCitations(dash: DashboardPayload | null, filingId: string): DocCitation[] {
  if (!dash || !filingId) return [];
  const out: DocCitation[] = [];
  for (const arr of Object.values(dash.extracted_values)) {
    for (const ev of arr) {
      if (ev.filing_id !== filingId) continue;
      const cat = metricKeyToClass(ev.metric_key);
      out.push({
        id: ev.id,
        kind: "metric",
        metricKey: ev.metric_key,
        charStart: ev.char_start,
        charEnd: ev.char_end,
        category: cat,
        label: ev.label,
        valueDisplay: formatValueForCitation(ev),
      });
    }
  }
  for (const risk of dash.risk_factor_changes) {
    if (risk.to_filing_id !== filingId) continue;
    if (risk.char_start == null || risk.char_end == null) continue;
    out.push({
      id: risk.id,
      kind: "risk",
      metricKey: null,
      charStart: risk.char_start,
      charEnd: risk.char_end,
      category: "risk",
      label: "Risk factor",
      valueDisplay: risk.factor_text.slice(0, 160),
    });
  }
  return out;
}

export default function SourceViewer() {
  const { filingId } = useParams<{ filingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const citeMetricKey = searchParams.get("cite");
  const citeId = searchParams.get("citeId");
  const citeStart = searchParams.get("start");
  const citeEnd = searchParams.get("end");

  const [filing, setFiling] = useState<FilingDetailResponse | null>(null);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [loadingFiling, setLoadingFiling] = useState(false);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 1024,
  );
  const [zoom, setZoom] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(0);
  const [enabledCategories, setEnabledCategories] = useState(DEFAULT_FILTER_ENABLED);
  const [pulseRequest, setPulseRequest] = useState<{ citationId: string; nonce: number } | null>(null);

  const { data: cachedData, loading: cacheLoading, error: cacheError, industry, setViewedFiling } = useAppShell();
  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setViewedFiling(null);
    setFiling(null);

    if (!filingId) return;

    setLoadingFiling(true);
    void (async () => {
      try {
        const res = await getFiling(filingId);
        setFiling(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load filing");
      } finally {
        setLoadingFiling(false);
      }
    })();
  }, [filingId, setViewedFiling]);

  useEffect(() => {
    if (!filing) {
      setViewedFiling(null);
      return;
    }

    setViewedFiling(filingDetailToStripMeta(filing));
    return () => {
      setViewedFiling(null);
    };
  }, [filing, setViewedFiling]);

  useEffect(() => {
    if (!filing?.ticker) return;
    setError(null);
    const sameContext = cachedData?.filing.id === filing.id;
    if (sameContext) {
      setDash(cachedData);
      setLoadingDash(false);
      return;
    }
    setLoadingDash(true);
    void (async () => {
      try {
        const payload = await loadDashboardWithIngestFallback(filing.ticker, industry);
        setDash(payload);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load filing metadata");
      } finally {
        setLoadingDash(false);
      }
    })();
  }, [cachedData, filing, industry]);

  const sections: SectionIndexEntry[] = filing?.section_index ?? [];
  const citations = useMemo(() => buildDocCitations(dash, filing?.id ?? ""), [dash, filing?.id]);
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery, sections]);

  const title = filing
    ? `${filing.ticker} · ${filing.filing_type} · ${filing.period_end_date}`
    : "Source";

  const jumpToSection = (idx: number) => {
    setActiveSection(idx);
    const anchor = sections[idx]?.anchor;
    if (!anchor) return;
    const el = document.getElementById(anchor);
    el?.scrollIntoView({ behavior: "auto", block: "start" });
  };

  const prevSection = () => {
    const next = Math.max(0, activeSection - 1);
    jumpToSection(next);
  };

  const nextSection = () => {
    const next = Math.min(sections.length - 1, activeSection + 1);
    jumpToSection(next);
  };

  const zoomIn = () => setZoom((z) => Math.min(2.25, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
  const zoomFit = () => {
    const w = docRef.current?.clientWidth ?? 800;
    const inner = docRef.current?.querySelector(".doc-inner") as HTMLElement | null;
    if (inner) {
      const scale = Math.min(1.6, w / (inner.scrollWidth || w));
      setZoom(+scale.toFixed(2));
    } else {
      setZoom(1);
    }
  };

  const toggleCategory = (cat: CiteCategory) =>
    setEnabledCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const triggerCitationPulse = (citationId: string) =>
    setPulseRequest({ citationId, nonce: Date.now() });

  const onPickSectionByAnchor = (anchor: string) => {
    const idx = sections.findIndex((s) => s.anchor === anchor);
    if (idx >= 0) jumpToSection(idx);
  };

  const loading = loadingFiling || loadingDash || cacheLoading;
  const pageError = error ?? cacheError;

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col bg-preview-bg text-preview-text">
      <Toolbar
        title={title}
        onBack={() => navigate(-1)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        sections={sections}
        activeSection={activeSection}
        onJumpSection={(i) => jumpToSection(i)}
        onPrevSection={prevSection}
        onNextSection={nextSection}
        enabledCategories={enabledCategories}
        onToggleCategory={toggleCategory}
      />
      {searchOpen && (
        <div className="border-b border-preview-chromeBorder bg-preview-chrome px-4 py-3">
          <label className="mx-auto flex max-w-3xl items-center gap-4 text-sm">
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.04em] text-preview-textDim">
              Find in document
            </span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border border-preview-chromeBorder bg-preview-sidebar px-3 py-2 text-sm text-preview-text outline-none focus:ring-1 focus:ring-preview-accent"
              placeholder="Filter sections and table of contents"
            />
          </label>
        </div>
      )}
      {pageError && (
        <div className="border-l-[3px] border-cite-risk bg-preview-chrome px-4 py-3 text-[13px] text-preview-text">
          Error loading data: {pageError}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          filing={filing}
          sections={filteredSections}
          html={filing?.cleaned_html ?? ""}
          citations={citations}
          enabledCategories={enabledCategories}
          onPickSection={onPickSectionByAnchor}
          onPickCitation={triggerCitationPulse}
        />
        <main className="min-w-0 flex-1 overflow-auto px-8 py-6">
          {loading && !filing && <div className="text-sm text-preview-textDim">Loading filing…</div>}
          {filing && (
            <DocumentView
              ref={docRef}
              html={filing.cleaned_html}
              citeMetricKey={citeMetricKey}
              citeId={citeId}
              citeStart={citeStart}
              citeEnd={citeEnd}
              pulseRequest={pulseRequest}
              zoom={zoom}
              citations={citations}
              enabledCategories={enabledCategories}
            />
          )}
        </main>
      </div>
    </div>
  );
}
