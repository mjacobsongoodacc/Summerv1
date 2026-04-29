import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

function pick(evMap: Record<string, ExtractedValue[]>, key: string): number | null {
  const v = evMap[key]?.[0]?.value_numeric;
  return v != null ? Number(v) : null;
}

export default function FCFvsNetIncome({ extractedValues, loading = false }: Props) {
  const data = useMemo(
    () =>
      YEARS.map((y) => ({
        year: String(y),
        fcf: pick(extractedValues, `free_cash_flow_fy${y}`),
        ni: pick(extractedValues, `net_income_fy${y}`),
      })),
    [extractedValues],
  );

  const hasData = data.some((d) => d.fcf != null || d.ni != null);

  return (
    <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-light tracking-wide text-white">
        <span className="inline-block h-2 w-2 shrink-0" style={{ backgroundColor: classToColor("fcf") }} aria-hidden />
        FCF vs net income
        <span className="ml-auto text-[11px] text-preview-textDim">Item 7</span>
      </h3>
      <div className="relative h-[240px] w-full border border-preview-chromeBorder p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#2F2F2F" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v: number) => (v == null ? "—" : v.toLocaleString())}
              contentStyle={{
                backgroundColor: "#2A2A2A",
                border: "1px solid #3A3A3A",
                color: "#E8E8E8",
              }}
            />
            {!loading && hasData && (
              <>
                <Line
                  type="monotone"
                  dataKey="fcf"
                  name="Free cash flow"
                  stroke={classToColor("fcf")}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="ni"
                  name="Net income"
                  stroke={classToColor("financial")}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </>
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
