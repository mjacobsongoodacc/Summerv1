import { Building2 } from "lucide-react";

const OPTIONS = ["Insurance", "Banks", "Industrials", "Consumer", "Tech", "Other"] as const;

export type Industry = (typeof OPTIONS)[number];

interface Props {
  value: Industry;
  onChange: (v: Industry) => void;
}

export default function IndustryDropdown({ value, onChange }: Props) {
  return (
    <label className="text-[13px]">
      <span className="sr-only">Industry</span>
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-preview-textDim" strokeWidth={1.75} aria-hidden />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Industry)}
          className="h-8 min-w-[156px] border border-preview-chromeBorder bg-transparent px-7 py-0 text-[13px] text-preview-text outline-none"
        >
          {OPTIONS.map((o) => (
            <option key={o} value={o} className="bg-preview-chrome text-preview-text">
              {o}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
