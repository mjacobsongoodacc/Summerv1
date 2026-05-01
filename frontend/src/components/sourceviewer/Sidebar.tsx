import { useMemo } from "react";
import ContentsList from "./ContentsList";
import type { DocCitation } from "./DocumentView";
import type { FilingDetailResponse, RiskFactorChange, SectionIndexEntry } from "../../types";
import type { CiteCategory } from "../../lib/citationColors";
import { useAppShell } from "../../AppContext";

type Props = {
  open: boolean;
  filing: FilingDetailResponse | null;
  sections: SectionIndexEntry[];
  html: string;
  citations: DocCitation[];
  enabledCategories: Record<CiteCategory, boolean>;
  onPickSection: (anchor: string) => void;
  onPickCitation: (citationId: string) => void;
};

function isNewSectionHeading(el: Element): boolean {
  const id = el.id ?? "";
  return typeof id === "string" && id.startsWith("item-");
}

/** Visible text after section anchor heading: heading + following siblings until length or next item-* section. */
function excerptForAnchor(doc: Document, anchor: string, maxLen = 280): string {
  const el = doc.getElementById(anchor);
  if (!el) return "";

  let acc = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  let n: Element | null = el.nextElementSibling;

  while (acc.length < maxLen && n) {
    if (isNewSectionHeading(n)) break;

    const part = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    if (part.length) {
      acc = acc.length === 0 ? part : `${acc} ${part}`;
    }

    if (acc.length >= maxLen) break;
    n = n.nextElementSibling;
  }

  return acc.slice(0, maxLen).trim();
}

export default function Sidebar({
  open,
  filing,
  sections,
  html,
  citations,
  enabledCategories,
  onPickSection,
  onPickCitation,
}: Props) {
  const { data: shellPayload } = useAppShell();

  const riskChangeTypeByCitationId = useMemo(() => {
    const out: Record<string, RiskFactorChange["change_type"]> = {};
    if (
      !filing?.id ||
      !shellPayload?.risk_factor_changes?.length ||
      shellPayload.filing.id !== filing.id
    ) {
      return out;
    }
    for (const r of shellPayload.risk_factor_changes) {
      if (r.to_filing_id === filing.id) out[r.id] = r.change_type;
    }
    return out;
  }, [filing?.id, shellPayload?.filing?.id, shellPayload?.risk_factor_changes]);

  const doc = useMemo(() => new DOMParser().parseFromString(html || "<body></body>", "text/html"), [html]);

  const preservedExcerptChars = useMemo(() => {
    if (!sections[0]?.anchor) return 0;
    return excerptForAnchor(doc, sections[0].anchor).length;
  }, [doc, sections]);

  if (!open) {
    return null;
  }

  return (
    <aside
      className="w-[260px] shrink-0 border-r border-preview-chromeBorder bg-preview-sidebar"
      data-excerpt-preservation-len={preservedExcerptChars}
    >
      <div className="border-b border-preview-chromeBorder px-4 py-3 text-[11px] font-normal uppercase tracking-[0.04em] text-preview-textDim">
        CONTENTS
      </div>
      <div className="max-h-[calc(100vh-120px)] overflow-auto p-3">
        {!filing && (
          <p className="px-3 py-2 text-xs text-preview-textDim">
            Loading…
          </p>
        )}
        {filing && (
          <>
            <ContentsList
              sections={sections}
              citations={citations}
              enabledCategories={enabledCategories}
              riskChangeTypeByCitationId={riskChangeTypeByCitationId}
              onPickSection={onPickSection}
              onPickCitation={onPickCitation}
            />
            {sections.length === 0 && (
              <p className="my-4 px-1 text-[11px] leading-relaxed text-preview-textDim">
                No indexed sections returned for this filing. Re-run ingest or refresh after the filing is rebuilt.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
