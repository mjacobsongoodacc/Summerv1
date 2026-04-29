import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { ExtractedValue } from "../../types";
import { classToColor, metricKeyToClass } from "../../lib/citationColors";

interface Props {
  ev: ExtractedValue;
  children: React.ReactNode;
}

function brighten(hex: string): string {
  const v = hex.replace("#", "");
  const n = Number.parseInt(v, 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 40);
  const g = Math.min(255, ((n >> 8) & 0xff) + 40);
  const b = Math.min(255, (n & 0xff) + 40);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ClickableNumber({ ev, children }: Props) {
  const navigate = useNavigate();
  const citeCol = useMemo(() => classToColor(metricKeyToClass(ev.metric_key)), [ev.metric_key]);

  const handleClick = () => {
    const params = new URLSearchParams({
      cite: ev.metric_key,
      start: String(ev.char_start),
      end: String(ev.char_end),
    });
    navigate(`/source/${ev.filing_id}?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ textDecorationColor: citeCol }}
      className="group inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-inherit underline decoration-dotted decoration-2 underline-offset-4"
      onMouseEnter={(e) => {
        (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = citeCol;
      }}
      onMouseOver={(e) => {
        (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = brighten(citeCol);
      }}
      onMouseOut={(e) => {
        (e.currentTarget.style as CSSStyleDeclaration).textDecorationColor = citeCol;
      }}
    >
      <span>{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
