import { Building2 } from "lucide-react";

const OPTIONS = ["Insurance", "Banks", "Industrials", "Consumer", "Tech", "Other"] as const;

export type Industry = (typeof OPTIONS)[number];

interface Props {
  value: Industry;
  onChange: (v: Industry) => void;
}

export default function IndustryDropdown({ value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-gray-500">
        <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        Industry
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Industry)}
        className="min-w-[160px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none ring-carnegie-navy focus:ring-1"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
