import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { CiteCategory } from "../../lib/citationColors";
import { classToColor, classToTint, classToTintHover } from "../../lib/citationColors";
import { citeLabelColor, normalizeSubState, renderDotWithGlyph } from "../../lib/citationGlyph";
import { normalizeParagraphText, paragraphSha1Hex } from "../../lib/anchorHash";

export interface DocCitation {
  id: string;
  kind: "metric" | "risk";
  metricKey?: string | null;
  charStart: number;
  charEnd: number;
  category: CiteCategory;
  label: string;
  valueDisplay: string;
  anchorText?: string | null;
  anchorHash?: string | null;
  /** Margin tiny-caps label from API */
  display_label?: string | null;
  /** Shape/direction for margin dots */
  sub_state?: string | null;
}

type Props = {
  html: string;
  citeMetricKey: string | null;
  citeId: string | null;
  citeStart: string | null;
  citeEnd: string | null;
  pulseRequest: { citationId: string; nonce: number } | null;
  zoom: number;
  citations: DocCitation[];
  enabledCategories: Record<CiteCategory, boolean>;
};

type MarginDot = {
  id: string;
  top: number;
  category: CiteCategory;
  title: string;
  displayLabel: string | null;
};

const LEAK_PATTERN = /\bdata-cite-wrap\b/;

/** Remove legacy span-based wraps from offset-based decoration (older builds). */
function stripLegacyInlineCiteSpans(secDoc: HTMLElement): void {
  secDoc.querySelectorAll<HTMLElement>("span[data-cite-wrap]").forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
  });
}

function applyAttrsToBlock(el: HTMLElement, c: DocCitation, enabled: Record<CiteCategory, boolean>): void {
  const cls = c.category;
  const ids = new Set<string>(
    ((el.dataset.citeWrap ?? "") as string).split(/\s+/).filter((x): x is string => Boolean(x)),
  );
  ids.add(c.id);
  el.dataset.citeWrap = [...ids].join(" ");
  el.dataset.citeCat = c.category;
  if (c.kind === "metric" && c.metricKey) {
    el.dataset.metricKey = c.metricKey;
  }

  el.classList.add("cite-target");
  el.style.setProperty("--cite-tint", classToTint(cls));
  el.style.setProperty("--cite-tint-hover", classToTintHover(cls));
  el.style.setProperty("--cite-color", classToColor(cls));
  el.classList.toggle("cite-filtered", !enabled[cls]);
}

function collectBlockCandidates(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>("p, li, td, th, div"));
  return all.filter((el) => {
    if (el.tagName !== "DIV") return true;
    return !el.querySelector("p, li, td, th, div");
  });
}

/** Strip every non-alphanumeric so whitespace/punctuation differences between bs4 and DOM textContent stop blocking matches. */
function alphanumKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Hash match on block text, then anchor_text prefix. Never injects offset-based spans (prevents mid-word splits). */
function applyCitationAnchoring(
  secDoc: HTMLElement,
  htmlSource: string,
  citations: DocCitation[],
  enabled: Record<CiteCategory, boolean>,
): void {
  if (LEAK_PATTERN.test(htmlSource)) {
    console.warn("[DocumentView] Skipping citation decoration: HTML string contains leaked data-cite-wrap");
    return;
  }

  stripLegacyInlineCiteSpans(secDoc);

  const blocks = collectBlockCandidates(secDoc);
  const matched = new Set<string>();

  const byHash = new Map<string, DocCitation[]>();
  for (const c of citations) {
    if (!c.anchorHash?.trim()) continue;
    const list = byHash.get(c.anchorHash) ?? [];
    list.push(c);
    byHash.set(c.anchorHash, list);
  }

  for (const block of blocks) {
    const norm = normalizeParagraphText(block.textContent ?? "");
    if (!norm) continue;
    const hex = paragraphSha1Hex(norm);
    const group = byHash.get(hex);
    if (!group) continue;
    for (const c of group) {
      if (!enabled[c.category]) continue;
      applyAttrsToBlock(block, c, enabled);
      matched.add(c.id);
    }
  }

  for (const c of citations) {
    if (matched.has(c.id)) continue;
    if (!enabled[c.category]) continue;
    const pref = normalizeParagraphText((c.anchorText ?? "").slice(0, 120));
    if (!pref) continue;
    const fullPref = pref.slice(0, 80);
    if (!fullPref) continue;
    for (const block of blocks) {
      const n = normalizeParagraphText(block.textContent ?? "");
      if (n.includes(fullPref)) {
        applyAttrsToBlock(block, c, enabled);
        matched.add(c.id);
        break;
      }
    }
  }

  const blockKeys: string[] = blocks.map((b) => alphanumKey(b.textContent ?? ""));
  for (const c of citations) {
    if (matched.has(c.id)) continue;
    if (!enabled[c.category]) continue;
    const probe = alphanumKey((c.anchorText ?? "").slice(0, 200)).slice(0, 50);
    if (probe.length < 24) continue;
    for (let i = 0; i < blocks.length; i += 1) {
      if (blockKeys[i].includes(probe)) {
        applyAttrsToBlock(blocks[i], c, enabled);
        matched.add(c.id);
        break;
      }
    }
  }
}

function qsByMetricKey(container: HTMLElement, key: string): HTMLElement | null {
  const esc = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const el = container.querySelector(`[data-metric-key="${esc}"]`);
  return el instanceof HTMLElement ? el : null;
}

function qsByCiteWrap(container: HTMLElement, id: string): HTMLElement | null {
  const esc = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const direct = container.querySelector(`[data-cite-wrap="${esc}"]`);
  if (direct instanceof HTMLElement) return direct;

  const all = container.querySelectorAll<HTMLElement>("[data-cite-wrap]");
  for (const node of all) {
    const v = node.getAttribute("data-cite-wrap") || "";
    if (v.split(/\s+/).includes(id)) return node;
  }
  return null;
}

function pulseEl(el: HTMLElement): void {
  el.classList.add("cite-pulse");
  window.setTimeout(() => el.classList.remove("cite-pulse"), 2100);
}

const DocumentView = forwardRef<HTMLDivElement, Props>(function DocumentView(
  {
    html,
    citeMetricKey,
    citeId,
    citeStart,
    citeEnd,
    pulseRequest,
    citations,
    enabledCategories,
    zoom,
  }: Props,
  ref,
) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [marginDots, setMarginDots] = useState<MarginDot[]>([]);

  useImperativeHandle(ref, () => outerRef.current as HTMLDivElement);

  const empty = !html || html.trim().length === 0;

  useLayoutEffect(() => {
    const inner = innerRef.current;
    const card = cardRef.current;
    if (!inner || !card || empty) {
      setMarginDots([]);
      return;
    }

    const secDoc = inner.querySelector<HTMLElement>(".sec-doc");
    if (!secDoc) return;

    if (!LEAK_PATTERN.test(html)) {
      applyCitationAnchoring(secDoc, html, citations, enabledCategories);
    }

    const wraps = secDoc.querySelectorAll<HTMLElement>("[data-cite-wrap]");
    const dots: MarginDot[] = [];
    const cardRect = card.getBoundingClientRect();

    const gapBetweenStacks = 4;
    const estimateBlockHeight = (cite: DocCitation): number => {
      const dotRow = 10;
      const lab = cite.display_label?.trim();
      if (!lab) return dotRow;
      return dotRow + 4 + 2 * (9 * 1.1);
    };

    wraps.forEach((el) => {
      const citeWrap = el.dataset.citeWrap ?? "";
      const ids = citeWrap.trim().split(/\s+/).filter(Boolean);
      const items = ids
        .map((citeIdDot) => {
          const cite = citations.find((c) => c.id === citeIdDot);
          const cat = cite?.category;
          if (!cite || !cat || !enabledCategories[cat]) return null;
          return { citeIdDot, cite };
        })
        .filter((x): x is { citeIdDot: string; cite: DocCitation } => x !== null);

      if (items.length === 0) return;

      const rects = el.getClientRects();
      const line = rects.length > 0 ? rects[0] : el.getBoundingClientRect();
      const centerY = line.top + line.height / 2 - cardRect.top;

      const heights = items.map(({ cite }) => estimateBlockHeight(cite));
      let totalH = 0;
      heights.forEach((h, ix) => {
        totalH += h + (ix > 0 ? gapBetweenStacks : 0);
      });

      let yCursor = centerY - totalH / 2;

      items.forEach(({ citeIdDot, cite }, ix) => {
        const lab = cite.display_label?.trim() ? cite.display_label.trim() : null;
        dots.push({
          id: citeIdDot,
          top: yCursor,
          category: cite.category,
          title: `${cite.label} — ${cite.valueDisplay}`,
          displayLabel: lab,
        });
        yCursor += heights[ix];
        if (ix < items.length - 1) yCursor += gapBetweenStacks;
      });
    });

    setMarginDots(dots);
  }, [html, citations, enabledCategories, empty, zoom]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!citeMetricKey || !inner) return;
    const secDoc = inner.querySelector(".sec-doc");
    if (!(secDoc instanceof HTMLElement)) return;
    const el = qsByMetricKey(secDoc, citeMetricKey);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    pulseEl(el);
  }, [citeMetricKey, html]);

  useEffect(() => {
    const inner = innerRef.current;
    const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
    const root = secDoc ?? inner;
    if (!root) return;

    if (citeId) {
      const el = qsByCiteWrap(root, citeId);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      pulseEl(el);
      return;
    }

    if (!citeStart || !citeEnd) return;
    const start = Number(citeStart);
    const end = Number(citeEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    const target = citations.find((c) => c.charStart === start && c.charEnd === end);
    if (!target) return;
    const el = qsByCiteWrap(root, target.id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    pulseEl(el);
  }, [citeEnd, citeId, citeStart, citations, html]);

  useEffect(() => {
    const inner = innerRef.current;
    const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
    const root = secDoc ?? inner;
    if (!pulseRequest || !root) return;
    const el = qsByCiteWrap(root, pulseRequest.citationId);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    pulseEl(el);
  }, [pulseRequest, html]);

  return (
    <div ref={outerRef} className="relative mx-auto max-w-[900px]">
      <div
        ref={cardRef}
        className="relative border border-preview-docBorder bg-preview-docBg py-14 pl-[100px] pr-14 text-preview-docText shadow-2xl"
      >
        {marginDots.map((d) => {
          const cite = citations.find((c) => c.id === d.id);
          const sub = normalizeSubState(cite?.sub_state);
          return (
            <button
              key={d.id}
              type="button"
              aria-label={d.title}
              title={d.title}
              className="cite-margin-hit pointer-events-auto absolute left-0 flex w-[88px] flex-col items-center pr-3"
              style={{ top: d.top }}
              onClick={() => {
                const inner = innerRef.current;
                const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
                const root = secDoc ?? inner;
                if (!root) return;
                const el = qsByCiteWrap(root, d.id);
                if (!el) return;
                el.scrollIntoView({ block: "center", behavior: "smooth" });
                pulseEl(el);
              }}
            >
              {renderDotWithGlyph(d.category, sub)}
              {d.displayLabel ? (
                <div className="cite-label line-clamp-2 break-words" style={{ color: citeLabelColor(d.category) }}>
                  {d.displayLabel}
                </div>
              ) : null}
            </button>
          );
        })}
        <div
          ref={innerRef}
          className="doc-inner"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {empty ? (
            <p className="text-sm font-normal text-preview-textDim">No source available yet</p>
          ) : (
            <div className="sec-doc" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>
    </div>
  );
});

export default DocumentView;
