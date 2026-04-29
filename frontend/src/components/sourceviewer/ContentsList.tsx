import { ChevronRight } from "lucide-react";
import type { DocCitation } from "./DocumentView";
import type { SectionIndexEntry } from "../../types";
import type { CiteCategory } from "../../lib/citationColors";
import { classToColor } from "../../lib/citationColors";

function overlaps(sec: SectionIndexEntry, c: DocCitation): boolean {
  const cs = sec.char_start ?? 0;
  const ce = sec.char_end ?? Number.MAX_SAFE_INTEGER;
  return c.charStart <= ce && c.charEnd >= cs;
}

type Props = {
  sections: SectionIndexEntry[];
  citations: DocCitation[];
  enabledCategories: Record<CiteCategory, boolean>;
  onPickSection: (anchor: string) => void;
  onPickCitation: (id: string) => void;
};

export default function ContentsList({ sections, citations, enabledCategories, onPickSection, onPickCitation }: Props) {
  return (
    <ul className="space-y-1 text-sm">
      {sections.map((s) => {
        const secCites = citations.filter((c) => overlaps(s, c) && enabledCategories[c.category]);
        const total = secCites.length;
        const dots = secCites.slice(0, 5);
        const showCountBadge = total > 5;

        return (
          <li key={s.anchor}>
            <div className="flex w-full items-center justify-between gap-2 px-2 py-1">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left leading-none text-sm"
                onClick={() => onPickSection(s.anchor)}
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-preview-textDim" strokeWidth={1.75} aria-hidden />
                <span
                  title={s.name}
                  className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-preview-text hover:text-preview-accent"
                >
                  {s.name}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-[1px]">
                <div className="flex shrink-0 items-center gap-[1px]">
                  {dots.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`${c.label} — ${c.valueDisplay}`}
                      title={`${c.label} — ${c.valueDisplay}`}
                      className="h-[6px] w-[6px] shrink-0 rounded-[1px]"
                      style={{ backgroundColor: classToColor(c.category) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickCitation(c.id);
                      }}
                    />
                  ))}
                </div>
                {showCountBadge ? (
                  <span className="ml-1 min-w-[1.125rem] text-center font-sans text-[10px] tabular-nums leading-none text-preview-textDim">
                    {total}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
