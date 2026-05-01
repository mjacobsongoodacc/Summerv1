import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DocCitation } from "./DocumentView";
import type { RiskFactorChange, SectionIndexEntry } from "../../types";
import type { CiteCategory } from "../../lib/citationColors";
import { citationsForSection, riskFactorChangePrefix } from "../../lib/citationColors";
import { citeLabelColor, normalizeSubState, renderDotWithGlyph } from "../../lib/citationGlyph";

function citationLineLabel(c: DocCitation): string {
  if (c.kind === "risk") {
    return c.valueDisplay.slice(0, 80).trim();
  }
  return c.label;
}

function toggleAnchor(set: Set<string>, anchor: string): Set<string> {
  const next = new Set(set);
  if (next.has(anchor)) next.delete(anchor);
  else next.add(anchor);
  return next;
}

type Props = {
  sections: SectionIndexEntry[];
  citations: DocCitation[];
  enabledCategories: Record<CiteCategory, boolean>;
  riskChangeTypeByCitationId?: Record<string, RiskFactorChange["change_type"]>;
  onPickSection: (anchor: string) => void;
  onPickCitation: (id: string) => void;
};

export default function ContentsList({
  sections,
  citations,
  enabledCategories,
  riskChangeTypeByCitationId = {},
  onPickSection,
  onPickCitation,
}: Props) {
  const [expandedAnchors, setExpandedAnchors] = useState<Set<string>>(() => new Set());

  const ensureExpanded = useCallback((anchor: string) => {
    setExpandedAnchors((prev) => {
      if (prev.has(anchor)) return prev;
      return toggleAnchor(prev, anchor);
    });
  }, []);

  const toggleExpanded = useCallback((anchor: string) => {
    setExpandedAnchors((prev) => toggleAnchor(prev, anchor));
  }, []);

  return (
    <ul className="space-y-1 text-sm">
      {sections.map((s) => {
        const secCites = citationsForSection(s, citations, enabledCategories);
        const total = secCites.length;
        const dots = secCites.slice(0, 5);
        const showCountBadge = total > 5;
        const expanded = expandedAnchors.has(s.anchor);

        return (
          <li key={s.anchor}>
            <div className="flex w-full items-stretch gap-1 px-2 py-1">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse section" : "Expand section"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-preview-textDim hover:bg-preview-sidebar/70"
                onClick={() => toggleExpanded(s.anchor)}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  title={s.name}
                  className="min-w-0 max-w-[min(160px,calc(100%-4rem))] truncate overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm leading-none text-preview-text hover:text-preview-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    ensureExpanded(s.anchor);
                    onPickSection(s.anchor);
                  }}
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  aria-label={`Show or hide citations listed for ${s.name}`}
                  className="min-h-8 min-w-0 flex-1 self-stretch"
                  onClick={() => toggleExpanded(s.anchor)}
                />
              </div>
              <div className="flex shrink-0 items-start gap-[1px]">
                <div className="flex max-w-[148px] shrink-0 flex-wrap justify-end gap-x-2 gap-y-1">
                  {dots.map((c) => {
                    const lab = c.display_label?.trim();
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-label={`${c.label} — ${c.valueDisplay}`}
                        title={`${c.label} — ${c.valueDisplay}`}
                        className="flex max-w-[76px] shrink-0 flex-col items-center gap-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickCitation(c.id);
                        }}
                      >
                        {renderDotWithGlyph(c.category, normalizeSubState(c.sub_state))}
                        {lab ? (
                          <div
                            className="cite-sidebar-label line-clamp-2 text-center"
                            style={{ color: citeLabelColor(c.category) }}
                          >
                            {lab}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {showCountBadge ? (
                  <span className="ml-1 min-w-[1.125rem] text-center font-sans text-[10px] tabular-nums leading-none text-preview-textDim">
                    {total}
                  </span>
                ) : null}
              </div>
            </div>
            {expanded && secCites.length > 0 ? (
              <div
                className="mb-2 border-l-2 border-preview-chromeBorder bg-preview-bg py-2 pl-4 ml-[12px]"
                role="region"
                aria-label={`Citations in ${s.name}`}
              >
                <ul className="space-y-0.5">
                  {secCites.map((c) => {
                    const riskType = c.kind === "risk" ? riskChangeTypeByCitationId[c.id] : undefined;
                    const prefix = c.kind === "risk" ? riskFactorChangePrefix(riskType) : null;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded py-1 pr-1 text-left text-[12px] leading-snug text-preview-text hover:bg-preview-sidebar/80"
                          onClick={() => onPickCitation(c.id)}
                        >
                          <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <span className="mt-[0.15em]">{renderDotWithGlyph(c.category, normalizeSubState(c.sub_state))}</span>
                            {c.display_label?.trim() ? (
                              <div
                                className="cite-sidebar-label line-clamp-2 text-center leading-none"
                                style={{ color: citeLabelColor(c.category) }}
                              >
                                {c.display_label.trim()}
                              </div>
                            ) : null}
                          </div>
                          {c.kind === "risk" ? (
                            <span className="inline-flex w-[14px] shrink-0 justify-center font-sans tabular-nums leading-none">
                              {prefix ? (
                                <span className={`${prefix.className} text-[11px] leading-none`}>
                                  {prefix.symbol}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{citationLineLabel(c)}</span>
                          <ChevronRight
                            className="mt-[0.2em] h-3 w-3 shrink-0 opacity-55"
                            aria-hidden
                            strokeWidth={1.75}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
