import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { ExtractedValue } from "../../types";

interface Props {
  ev: ExtractedValue;
  children: React.ReactNode;
}

export default function ClickableNumber({ ev, children }: Props) {
  const navigate = useNavigate();

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
      className="group inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-mono tabular-nums text-inherit underline decoration-dotted decoration-gray-400 underline-offset-4 hover:decoration-carnegie-navy"
    >
      <span>{children}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
