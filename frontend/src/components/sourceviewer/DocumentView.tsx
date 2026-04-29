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

export interface DocCitation {
  id: string;
  kind: "metric" | "risk";
  metricKey?: string | null;
  charStart: number;
  charEnd: number;
  category: CiteCategory;
  label: string;
  valueDisplay: string;
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
  color: string;
  title: string;
};

/** Map index in cleaned HTML source to plaintext offset (characters outside `<...>`). */
function sourceIndexToPlainOffset(htmlSource: string, sourceIdx: number): number {
  let plain = 0;
  let i = 0;
  const end = Math.min(sourceIdx, htmlSource.length);
  while (i < end) {
    if (htmlSource[i] === "<") {
      const close = htmlSource.indexOf(">", i + 1);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    plain += 1;
    i += 1;
  }
  return plain;
}

function citationPlainRange(
  htmlSource: string,
  charStart: number,
  charEnd: number,
): { start: number; end: number } | null {
  if (!(charEnd > charStart) || charStart < 0 || charEnd > htmlSource.length) return null;

  let s = charStart;
  while (s < htmlSource.length && s < charEnd) {
    if (htmlSource[s] === "<") {
      const close = htmlSource.indexOf(">", s + 1);
      if (close === -1) return null;
      s = close + 1;
      continue;
    }
    break;
  }
  if (s >= charEnd) return null;

  const plainStart = sourceIndexToPlainOffset(htmlSource, s);
  const plainEnd = sourceIndexToPlainOffset(htmlSource, charEnd);
  if (!(plainEnd > plainStart)) return null;

  return { start: plainStart, end: plainEnd };
}

/** Build range over plaintext offsets; populate empty span via surroundContents / fallback. Returns span only on success (caller applies attributes after). */
function wrapPlainTextRange(container: HTMLElement, plainStart: number, plainEnd: number): HTMLSpanElement | null {
  if (!(plainEnd > plainStart)) return null;

  const texts: Text[] = [];
  walkTextNodesSkippingScripts(container, texts);

  let consumed = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;

  for (const tn of texts) {
    const len = tn.length;
    const nextConsumed = consumed + len;
    if (startNode === null && plainStart < nextConsumed) {
      startNode = tn;
      startOff = plainStart - consumed;
    }
    if (plainEnd <= nextConsumed) {
      endNode = tn;
      endOff = plainEnd - consumed;
      break;
    }
    consumed += len;
  }

  if (!startNode || !endNode || startOff < 0 || endOff <= 0 || endOff > endNode.length) {
    return null;
  }

  const span = document.createElement("span");
  const range = document.createRange();

  try {
    range.setStart(startNode, Math.max(0, startOff));
    range.setEnd(endNode, Math.min(endOff, endNode.length));
    try {
      range.surroundContents(span);
      return span;
    } catch {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      return span;
    }
  } catch {
    return null;
  }
}

function walkTextNodesSkippingScripts(root: HTMLElement, out: Text[]) {
  function walk(el: HTMLElement) {
    const tag = el.tagName?.toUpperCase?.() ?? "";
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) out.push(child as Text);
      else if (child.nodeType === Node.ELEMENT_NODE) walk(child as HTMLElement);
    }
  }

  walk(root);
}

const LEAK_PATTERN = /\bdata-cite-wrap\b/;

function applyCitationsDom(
  container: HTMLElement,
  htmlSource: string,
  citations: DocCitation[],
  enabled: Record<CiteCategory, boolean>,
): void {
  if (LEAK_PATTERN.test(htmlSource)) {
    console.warn("[DocumentView] Skipping citation decoration: raw html contains leaked data-cite-wrap (backend/HTML issue)");
    return;
  }

  const ops = citations
    .filter((c) => c.charEnd > c.charStart && c.charStart >= 0 && c.charEnd <= htmlSource.length)
    .map((c) => ({
      citation: c,
      plain: citationPlainRange(htmlSource, c.charStart, c.charEnd),
    }))
    .filter((o): o is typeof o & { plain: { start: number; end: number } } => o.plain != null)
    .sort((a, b) => b.plain.end - a.plain.end || b.plain.start - a.plain.start);

  for (const { citation: c, plain } of ops) {
    const span = wrapPlainTextRange(container, plain.start, plain.end);
    if (!span) continue;

    const cls = c.category;
    span.setAttribute("data-cite-wrap", c.id);
    span.setAttribute("data-cite-cat", c.category);
    if (c.kind === "metric" && c.metricKey) {
      span.setAttribute("data-metric-key", c.metricKey);
    }
    span.classList.add("cite-target");
    span.style.setProperty("--cite-tint", classToTint(cls));
    span.style.setProperty("--cite-tint-hover", classToTintHover(cls));
    span.style.setProperty("--cite-color", classToColor(cls));
    if (!enabled[cls]) {
      span.classList.add("cite-filtered");
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
  const el = container.querySelector(`[data-cite-wrap="${esc}"]`);
  return el instanceof HTMLElement ? el : null;
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

    Array.from(secDoc.querySelectorAll<HTMLElement>("span[data-cite-wrap]")).forEach((el) => el.remove());

    if (!LEAK_PATTERN.test(html)) {
      applyCitationsDom(secDoc, html, citations, enabledCategories);
    }

    const wraps = secDoc.querySelectorAll<HTMLElement>("[data-cite-wrap]");
    const dots: MarginDot[] = [];
    const cardRect = card.getBoundingClientRect();
    wraps.forEach((el) => {
      const cat = el.dataset.citeCat as CiteCategory | undefined;
      if (!cat || !enabledCategories[cat]) return;
      const id = el.dataset.citeWrap;
      if (!id) return;
      const rects = el.getClientRects();
      const line = rects.length > 0 ? rects[0] : el.getBoundingClientRect();
      const centerY = line.top + line.height / 2 - cardRect.top;
      const top = centerY - 5;
      const cite = citations.find((c) => c.id === id);
      const title = cite ? `${cite.label} — ${cite.valueDisplay}` : "";
      dots.push({
        id,
        top,
        color: classToColor(cat),
        title,
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
    el.scrollIntoView({ block: "center", behavior: "auto" });
    el.classList.add("cite-pulse");
    const t = window.setTimeout(() => el.classList.remove("cite-pulse"), 3100);
    return () => window.clearTimeout(t);
  }, [citeMetricKey, html]);

  useEffect(() => {
    const inner = innerRef.current;
    const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
    const root = secDoc ?? inner;
    if (!root) return;

    const fallback = () => {
      if (!citeId) return;
      const el = qsByCiteWrap(root, citeId);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "auto" });
      el.classList.add("cite-pulse");
      window.setTimeout(() => el.classList.remove("cite-pulse"), 3100);
    };

    if (citeId) {
      fallback();
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
    el.scrollIntoView({ block: "center", behavior: "auto" });
    el.classList.add("cite-pulse");
    window.setTimeout(() => el.classList.remove("cite-pulse"), 3100);
  }, [citeEnd, citeId, citeStart, citations, html]);

  useEffect(() => {
    const inner = innerRef.current;
    const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
    const root = secDoc ?? inner;
    if (!pulseRequest || !root) return;
    const el = qsByCiteWrap(root, pulseRequest.citationId);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
    el.classList.add("cite-pulse");
    window.setTimeout(() => el.classList.remove("cite-pulse"), 3100);
  }, [pulseRequest, html]);

  return (
    <div ref={outerRef} className="relative mx-auto max-w-[900px]">
      <div
        ref={cardRef}
        className="relative border border-preview-docBorder bg-preview-docBg py-14 pl-9 pr-14 text-preview-docText shadow-2xl"
      >
        {marginDots.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-label={d.title}
            title={d.title}
            className="pointer-events-auto absolute left-[12px] h-[10px] w-[10px]"
            style={{ top: d.top, backgroundColor: d.color }}
            onClick={() => {
              const inner = innerRef.current;
              const secDoc = inner?.querySelector(".sec-doc") as HTMLElement | null;
              const root = secDoc ?? inner;
              if (!root) return;
              const el = qsByCiteWrap(root, d.id);
              if (!el) return;
              el.scrollIntoView({ block: "center", behavior: "auto" });
              el.classList.add("cite-pulse");
              window.setTimeout(() => el.classList.remove("cite-pulse"), 3100);
            }}
          />
        ))}
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
