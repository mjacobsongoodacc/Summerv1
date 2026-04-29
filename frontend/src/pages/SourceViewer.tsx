import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { getFiling } from "../api";
import type { FilingDetailResponse, SectionIndexEntry } from "../types";
import Toolbar from "../components/sourceviewer/Toolbar";
import Sidebar from "../components/sourceviewer/Sidebar";
import DocumentView from "../components/sourceviewer/DocumentView";

export default function SourceViewer() {
  const { filingId } = useParams<{ filingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const startStr = searchParams.get("start");
  const endStr = searchParams.get("end");
  const citeRange =
    startStr != null && endStr != null
      ? { start: Number(startStr), end: Number(endStr) }
      : null;

  const [filing, setFiling] = useState<FilingDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<"thumbnails" | "contents">("thumbnails");
  const [zoom, setZoom] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState(0);

  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filingId) return;
    void (async () => {
      try {
        const res = await getFiling(filingId);
        setFiling(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load filing");
      }
    })();
  }, [filingId]);

  const sections: SectionIndexEntry[] = filing?.section_index ?? [];

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => s.name.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  const title = filing
    ? `${filing.ticker} · ${filing.filing_type} · ${filing.period_end_date}`
    : "Source";

  useLayoutEffect(() => {
    if (!docRef.current) return;
    const mark = docRef.current.querySelector("mark[data-cite]");
    if (mark) {
      mark.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [filing?.cleaned_html, citeRange?.start, citeRange?.end]);

  const jumpToSection = (idx: number) => {
    setActiveSection(idx);
    const anchor = sections[idx]?.anchor;
    if (!anchor) return;
    const el = document.getElementById(anchor);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div className="flex h-screen flex-col bg-[#fbfbfa] text-gray-900">
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
      />
      {searchOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <label className="mx-auto flex max-w-3xl items-center gap-3 text-sm">
            <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
              <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Find in document
            </span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm outline-none ring-carnegie-navy focus:ring-1"
              placeholder="Filter sections and table of contents"
            />
          </label>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-gray-500">
            Filtering applies to the section list in the sidebar; full-document text search will arrive with ingest-quality HTML.
          </p>
        </motion.div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          mode={mode}
          onModeChange={setMode}
          filing={filing}
          sections={filteredSections}
          html={filing?.cleaned_html ?? ""}
          onPickSection={(anchor) => {
            const idx = sections.findIndex((s) => s.anchor === anchor);
            if (idx >= 0) jumpToSection(idx);
          }}
        />
        <main className="min-w-0 flex-1 overflow-auto p-6">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          {!filing && !error && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
              Loading filing…
            </div>
          )}
          {filing && (
            <DocumentView
              ref={docRef}
              html={filing.cleaned_html}
              citeRange={citeRange && !Number.isNaN(citeRange.start) ? citeRange : null}
              zoom={zoom}
            />
          )}
        </main>
      </div>
    </div>
  );
}
