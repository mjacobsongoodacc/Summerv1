import { useId } from "react";
import { Hash } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function TickerInput({ value, onChange }: Props) {
  const id = useId();
  return (
    <label className="text-[13px]">
      <span className="sr-only">Ticker</span>
      <div className="relative">
        <Hash className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-preview-textDim" strokeWidth={1.75} aria-hidden />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-24 border border-preview-chromeBorder bg-transparent px-7 py-0 font-mono text-[13px] tabular-nums leading-none text-preview-text outline-none"
          placeholder="PGR"
          maxLength={8}
        />
      </div>
    </label>
  );
}
