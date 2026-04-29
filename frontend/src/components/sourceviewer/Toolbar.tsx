import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  Filter,
  PanelLeftClose,
  PanelRightOpen,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { CiteCategory } from "../../lib/citationColors";
import { classToColor } from "../../lib/citationColors";
import type { SectionIndexEntry } from "../../types";

const FILTER_LABELS: Record<CiteCategory, string> = {
  risk: "Risk factors",
  financial: "Financial",
  debt: "Debt",
  fcf: "FCF/NI",
  sbc: "SBC",
  insurance: "Insurance",
};

type Props = {
  title: string;
  onBack: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  sections: SectionIndexEntry[];
  activeSection: number;
  onJumpSection: (index: number) => void;
  onPrevSection: () => void;
  onNextSection: () => void;
  enabledCategories: Record<CiteCategory, boolean>;
  onToggleCategory: (cat: CiteCategory) => void;
};

const chipBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center border border-preview-chromeBorder text-preview-text";

export default function Toolbar({
  title,
  onBack,
  sidebarOpen,
  onToggleSidebar,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  searchOpen,
  onToggleSearch,
  sections,
  activeSection,
  onJumpSection,
  onPrevSection,
  onNextSection,
  enabledCategories,
  onToggleCategory,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const sectionIndexForSelect =
    sections.length === 0 ? 0 : Math.min(Math.max(0, activeSection), sections.length - 1);

  useEffect(() => {
    if (!filterOpen) return;
    const close = (e: MouseEvent) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  return (
    <header className="relative z-30 flex h-[44px] shrink-0 items-center gap-3 overflow-x-auto border-b border-preview-chromeBorder bg-preview-chrome px-3">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="inline-flex items-center gap-2 border border-preview-chromeBorder px-3 py-1.5 text-xs font-normal uppercase tracking-[0.04em] text-preview-text"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="hidden sm:inline">Back</span>
      </button>
      <button
        type="button"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        className="inline-flex items-center gap-2 border border-preview-chromeBorder px-2 py-1 text-xs font-normal uppercase tracking-[0.04em] text-preview-text"
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <PanelRightOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        )}
        <span className="hidden sm:inline">{sidebarOpen ? "Hide sidebar" : "Sidebar"}</span>
      </button>
      <div className="max-w-[34rem] truncate text-center text-sm font-normal tracking-[0.04em] text-preview-text">{title}</div>
      <div className="hidden items-center gap-2 md:flex">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={chipBtn}>
          <ZoomOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={chipBtn}>
          <ZoomIn className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          onClick={onZoomFit}
          className="inline-flex items-center gap-1.5 border border-preview-chromeBorder px-3 py-1.5 text-xs font-normal uppercase tracking-[0.04em] text-preview-text"
        >
          <Expand className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Fit
        </button>
        <span className="font-mono text-xs tabular-nums text-preview-textDim">{Math.round(zoom * 100)}%</span>
      </div>
      <button
        type="button"
        aria-label={searchOpen ? "Close find" : "Find in document"}
        onClick={onToggleSearch}
        className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-normal uppercase tracking-[0.04em] ${
          searchOpen ? "border-preview-accent text-preview-accent" : "border-preview-chromeBorder text-preview-text"
        }`}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        Find
      </button>
      <div className="relative" ref={filterWrapRef}>
        <button
          type="button"
          aria-label="Citation filters"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((v) => !v)}
          className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-normal uppercase tracking-[0.04em] ${
            filterOpen ? "border-preview-accent text-preview-accent" : "border-preview-chromeBorder text-preview-text"
          }`}
        >
          <Filter className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Filter
        </button>
        {filterOpen && (
          <div
            role="dialog"
            aria-label="Citation visibility"
            className="absolute right-0 top-full z-[70] mt-1 min-w-[220px] border border-preview-chromeBorder bg-preview-chrome p-3 shadow-lg"
          >
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FILTER_LABELS) as CiteCategory[]).map((cat) => {
                const on = enabledCategories[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onToggleCategory(cat)}
                    className={`flex items-center gap-2 px-2 py-1.5 text-left text-[11px] text-preview-text ${
                      on ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 border border-preview-chromeBorder"
                      style={{ backgroundColor: classToColor(cat) }}
                      aria-hidden
                    />
                    {FILTER_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <label className="sr-only" htmlFor="section-jump">
          Jump to section
        </label>
        <select
          id="section-jump"
          className="max-w-[min(200px,40vw)] min-w-[8rem] border border-preview-chromeBorder bg-preview-sidebar px-2 py-1 text-xs text-preview-text outline-none focus:ring-1 focus:ring-preview-accent disabled:opacity-40"
          value={sectionIndexForSelect}
          disabled={sections.length === 0}
          onChange={(e) => onJumpSection(Number(e.target.value))}
        >
          {sections.length === 0 ? (
            <option value={0}>No sections loaded</option>
          ) : (
            sections.map((s, i) => (
              <option key={s.anchor} value={i}>
                {s.name}
              </option>
            ))
          )}
        </select>
        <button type="button" aria-label="Previous section" onClick={onPrevSection} className={chipBtn}>
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Next section" onClick={onNextSection} className={chipBtn}>
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
