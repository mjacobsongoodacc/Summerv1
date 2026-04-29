import type { ExtractedValue } from "../../types";
import ClickableNumber from "../ui/ClickableNumber";
import { classToColor } from "../../lib/citationColors";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
  loading?: boolean;
}

function Stat({
  label,
  ev,
  suffix,
}: {
  label: string;
  ev: ExtractedValue | undefined;
  suffix?: string;
}) {
  const raw =
    ev?.value_numeric != null
      ? ev.value_numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : ev?.value_text ?? "—";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">{label}</div>
      <div className="mt-1 font-mono text-[22px] tabular-nums text-white">
        {ev ? <ClickableNumber ev={ev}>{raw}</ClickableNumber> : <span>{raw}</span>}
        {suffix ? <span className="ml-1 text-[11px] normal-case text-preview-textDim">{suffix}</span> : null}
      </div>
    </div>
  );
}

export default function InsuranceOverlay({ extractedValues, loading = false }: Props) {
  const metrics = [
    { label: "Combined ratio", key: "insurance_combined_ratio_fy2025", suffix: "%" },
    { label: "Loss ratio", key: "insurance_loss_ratio_fy2025", suffix: "%" },
    { label: "Expense ratio", key: "insurance_expense_ratio_fy2025", suffix: "%" },
    { label: "Portfolio yield", key: "insurance_portfolio_yield_fy2025", suffix: "%" },
    { label: "Duration", key: "insurance_duration_years_fy2025" },
    { label: "Reserve development", key: "insurance_reserve_development_pct_fy2025", suffix: "%" },
  ];

  return (
    <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-light tracking-wide text-white">
        <span
          className="inline-block h-2 w-2 shrink-0"
          style={{ backgroundColor: classToColor("insurance") }}
          aria-hidden
        />
        Insurance underwriting overlay
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metrics.map((m) => (
          <Stat
            key={m.key}
            label={m.label.toUpperCase()}
            ev={loading ? undefined : extractedValues[m.key]?.[0]}
            suffix={m.suffix}
          />
        ))}
      </div>
    </article>
  );
}
