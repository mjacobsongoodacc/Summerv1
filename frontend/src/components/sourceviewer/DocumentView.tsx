import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { animate } from "framer-motion";
import { FileQuestion } from "lucide-react";

interface Props {
  html: string;
  citeRange: { start: number; end: number } | null;
  zoom: number;
}

const DocumentView = forwardRef<HTMLDivElement, Props>(function DocumentView(
  { html, citeRange, zoom }: Props,
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  const processed = useMemo(() => {
    if (!html) return "";
    if (!citeRange) return html;
    const { start, end } = citeRange;
    if (start < 0 || end > html.length || start >= end) return html;
    return (
      html.slice(0, start) +
      `<mark data-cite="1" class="cite-mark">` +
      html.slice(start, end) +
      `</mark>` +
      html.slice(end)
    );
  }, [html, citeRange]);

  const empty = !html || html.trim().length === 0;

  useEffect(() => {
    const mark = rootRef.current?.querySelector("mark[data-cite]");
    if (!mark || !(mark instanceof HTMLElement)) return;
    mark.style.willChange = "box-shadow, background-color";
    void animate(
      mark,
      {
        backgroundColor: ["rgba(250, 204, 21, 0.75)", "rgba(250, 204, 21, 0)", "rgba(250, 204, 21, 0)"],
        boxShadow: [
          "0 0 0 6px rgba(250, 204, 21, 0.25)",
          "0 0 0 0 rgba(250, 204, 21, 0)",
          "inset 0 -1px 0 0 rgba(26, 54, 93, 0.45)",
        ],
      },
      { duration: 3, ease: "easeOut" },
    );
    return () => {
      mark.style.willChange = "auto";
    };
  }, [processed]);

  return (
    <div
      ref={rootRef}
      className="mx-auto max-w-4xl rounded-md border border-gray-200 bg-white p-8 shadow-sm"
      style={{ minHeight: 420 }}
    >
      <div
        className="doc-inner origin-top text-sm leading-relaxed text-gray-900 transition-transform duration-150 ease-out"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        {empty ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FileQuestion className="h-10 w-10 text-gray-300" strokeWidth={1.25} aria-hidden />
            <p className="text-sm font-normal text-gray-500">No source available yet</p>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: processed }} />
        )}
      </div>
    </div>
  );
});

export default DocumentView;
