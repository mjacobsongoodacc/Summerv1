import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  PanelLeftClose,
  PanelRightOpen,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface Props {
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
  sections: { name: string; anchor: string }[];
  activeSection: number;
  onJumpSection: (index: number) => void;
  onPrevSection: () => void;
  onNextSection: () => void;
}

const iconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50";

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
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-gray-200 bg-white/85 px-3 shadow-sm backdrop-blur-md">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-xs font-normal uppercase tracking-wide text-gray-700 hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="hidden sm:inline">Back</span>
      </button>
      <button
        type="button"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        className="inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs font-normal uppercase tracking-wide text-gray-600 hover:bg-gray-50"
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <PanelRightOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        )}
        <span className="hidden sm:inline">{sidebarOpen ? "Hide sidebar" : "Sidebar"}</span>
      </button>
      <div className="flex-1 truncate text-center text-sm font-normal tracking-wide text-gray-800">{title}</div>
      <div className="hidden items-center gap-2 md:flex">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className={iconBtn}>
          <ZoomOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className={iconBtn}>
          <ZoomIn className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Fit to width"
          onClick={onZoomFit}
          className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs font-normal uppercase tracking-wide text-gray-600 hover:bg-gray-50"
        >
          <Expand className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Fit
        </button>
        <span className="font-mono text-xs tabular-nums text-gray-500">{Math.round(zoom * 100)}%</span>
      </div>
      <button
        type="button"
        aria-label={searchOpen ? "Close find" : "Find in document"}
        onClick={onToggleSearch}
        className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-normal uppercase tracking-wide ${
          searchOpen ? "border-carnegie-navy text-carnegie-navy" : "border-gray-200 text-gray-700"
        } hover:bg-gray-50`}
      >
        <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        Find
      </button>
      <div className="hidden items-center gap-2 lg:flex">
        <label className="sr-only" htmlFor="section-jump">
          Jump to section
        </label>
        <select
          id="section-jump"
          className="max-w-[200px] rounded border border-gray-200 bg-white px-2 py-1 text-xs outline-none ring-carnegie-navy focus:ring-1"
          value={activeSection}
          onChange={(e) => onJumpSection(Number(e.target.value))}
        >
          {sections.map((s, i) => (
            <option key={s.anchor} value={i}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" aria-label="Previous section" onClick={onPrevSection} className={iconBtn}>
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Next section" onClick={onNextSection} className={iconBtn}>
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
