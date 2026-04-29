import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExtractedValue } from "../../types";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
}

const YEARS = [2021, 2022, 2023, 2024, 2025];

export default function SBCAsPercentOCF({ extractedValues }: Props) {
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-light tracking-wide text-carnegie-navy">SBC as % of operating cash flow</h3>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[0, "auto"]} unit="%" />
            <Tooltip
              formatter={(value) => {
                const v = typeof value === "number" ? value : Number(value);
                const pct = Number.isFinite(v) ? `${v.toFixed(2)}%` : "—";
                return [pct, "SBC / OCF"];
              }}
            />
            <Legend />
            <ReferenceLine y={20} stroke="#cbd5e1" strokeDasharray="4 4" label={{ value: "20%", fill: "#94a3b8", fontSize: 10 }} />
            <Line type="monotone" dataKey="pct" name="SBC % of OCF" stroke="#1a365d" strokeWidth={2} dot connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
