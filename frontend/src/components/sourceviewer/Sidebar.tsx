import { LayoutGrid, List, Loader2 } from "lucide-react";
import ThumbnailCard from "./ThumbnailCard";
import ContentsList from "./ContentsList";
import type { FilingDetailResponse, SectionIndexEntry } from "../../types";

interface Props {
  open: boolean;
  mode: "thumbnails" | "contents";
  onModeChange: (m: "thumbnails" | "contents") => void;
  filing: FilingDetailResponse | null;
  sections: SectionIndexEntry[];
  html: string;
  onPickSection: (anchor: string) => void;
}

function excerptForAnchor(html: string, anchor: string, maxLen = 280): string {
  if (!html) return "";
  const idPattern = new RegExp(`id=["']${anchor}["']`, "i");
  const idx = html.search(idPattern);
  if (idx === -1) {
    const stripped = html.replace(/<[^>]+>/g, " ");
    return stripped.slice(0, maxLen).trim();
  }
  const slice = html.slice(idx, idx + 800);
  const text = slice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const lines = text.split(" ").slice(0, 40).join(" ");
  return lines.slice(0, maxLen);
}

export default function Sidebar({
  open,
  mode,
  onModeChange,
  filing,
  sections,
  html,
  onPickSection,
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <aside className="w-[220px] shrink-0 border-r border-gray-200 bg-white">
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-center text-[11px] font-normal uppercase tracking-wide ${
            mode === "thumbnails" ? "border-b-2 border-carnegie-navy text-carnegie-navy" : "text-gray-500"
          }`}
          onClick={() => onModeChange("thumbnails")}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          Thumbnails
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-center text-[11px] font-normal uppercase tracking-wide ${
            mode === "contents" ? "border-b-2 border-carnegie-navy text-carnegie-navy" : "text-gray-500"
          }`}
          onClick={() => onModeChange("contents")}
        >
          <List className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          Contents
        </button>
      </div>
      <div className="max-h-[calc(100vh-120px)] overflow-auto p-3">
        {!filing && (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
            Loading…
          </p>
        )}
        {filing && mode === "thumbnails" && (
          <div className="space-y-3">
            {sections.map((s) => (
              <ThumbnailCard
                key={s.anchor}
                label={s.name}
                excerpt={excerptForAnchor(html, s.anchor)}
                onClick={() => onPickSection(s.anchor)}
              />
            ))}
          </div>
        )}
        {filing && mode === "contents" && <ContentsList sections={sections} onPick={onPickSection} />}
      </div>
    </aside>
  );
}
