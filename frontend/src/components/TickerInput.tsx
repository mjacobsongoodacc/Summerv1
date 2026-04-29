import { Hash } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function TickerInput({ value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-gray-500">
        <Hash className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        Ticker
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-28 rounded-md border border-gray-200 px-3 py-2 font-mono text-sm tabular-nums outline-none ring-carnegie-navy focus:ring-1"
        placeholder="PGR"
        maxLength={8}
      />
    </label>
  );
}
