import type { ExtractedValue } from "../../types";
import ClickableNumber from "../ui/ClickableNumber";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
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
    <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-gray-900">
        {ev ? (
          <>
            <ClickableNumber ev={ev}>
              {raw}
              {suffix ? ` ${suffix}` : ""}
            </ClickableNumber>
          </>
        ) : (
          <span>{raw}</span>
        )}
      </div>
      {ev?.label?.startsWith("PLACEHOLDER") && (
        <p className="mt-1 text-[11px] font-normal leading-snug text-gray-500">{ev.label}</p>
      )}
    </div>
  );
}

export default function InsuranceOverlay({ extractedValues }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-light tracking-wide text-carnegie-navy">Insurance underwriting overlay</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Combined ratio" ev={extractedValues.insurance_combined_ratio_fy2025?.[0]} suffix="%" />
        <Stat label="Loss ratio" ev={extractedValues.insurance_loss_ratio_fy2025?.[0]} suffix="%" />
        <Stat label="Expense ratio" ev={extractedValues.insurance_expense_ratio_fy2025?.[0]} suffix="%" />
        <Stat label="Portfolio yield" ev={extractedValues.insurance_portfolio_yield_fy2025?.[0]} suffix="%" />
        <Stat label="Duration (years)" ev={extractedValues.insurance_duration_years_fy2025?.[0]} />
        <Stat label="Reserve development" ev={extractedValues.insurance_reserve_development_pct_fy2025?.[0]} suffix="%" />
      </div>
    </div>
  );
}
