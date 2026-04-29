import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExtractedValue } from "../../types";
import { classToColor } from "../../lib/citationColors";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
  loading?: boolean;
}

const YEARS = [2021, 2022, 2023, 2024, 2025];

export default function SBCAsPercentOCF({ extractedValues, loading = false }: Props) {
  const data = useMemo(() => {
    return YEARS.map((y) => {
      const sbc = extractedValues[`sbc_absolute_fy${y}`]?.[0]?.value_numeric ?? null;
      const ocf = extractedValues[`operating_cash_flow_fy${y}`]?.[0]?.value_numeric ?? null;
      let pct: number | null = null;
      if (sbc != null && ocf != null && ocf !== 0) {
        pct = (Number(sbc) / Number(ocf)) * 100;
      }
      return { year: String(y), pct };
    });
  }, [extractedValues]);

  const hasData = data.some((d) => d.pct != null);

  return (
    <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-light tracking-wide text-white">
        <span className="inline-block h-2 w-2 shrink-0" style={{ backgroundColor: classToColor("sbc") }} aria-hidden />
        SBC as % of operating cash flow
        <span className="ml-auto text-[11px] text-preview-textDim">Item 5</span>
      </h3>
      <div className="relative h-[240px] w-full border border-preview-chromeBorder p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#2F2F2F" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} domain={[0, "auto"]} unit="%" />
            <Tooltip
              formatter={(value) => {
                const v = typeof value === "number" ? value : Number(value);
                const pct = Number.isFinite(v) ? `${v.toFixed(2)}%` : "—";
                return [pct, "SBC / OCF"];
              }}
              contentStyle={{
                backgroundColor: "#2A2A2A",
                border: "1px solid #3A3A3A",
                color: "#E8E8E8",
              }}
            />
            <ReferenceLine y={20} stroke="#9A9A9A" strokeDasharray="4 4" />
            {loading || !hasData ? null : (
              <Line
                type="monotone"
                dataKey="pct"
                name="SBC % of OCF"
                stroke={classToColor("sbc")}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        {!loading && !hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-preview-textDim">
            No data available
          </div>
        )}
      </div>
    </article>
  );
}
