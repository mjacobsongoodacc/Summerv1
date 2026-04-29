import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

function pick(evMap: Record<string, ExtractedValue[]>, key: string): number | null {
  const v = evMap[key]?.[0]?.value_numeric;
  return v != null ? Number(v) : null;
}

export default function FCFvsNetIncome({ extractedValues }: Props) {
  const data = useMemo(
    () =>
      YEARS.map((y) => ({
        year: String(y),
        fcf: pick(extractedValues, `free_cash_flow_fy${y}`),
        ni: pick(extractedValues, `net_income_fy${y}`),
      })),
    [extractedValues],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-light tracking-wide text-carnegie-navy">FCF vs net income</h3>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={["auto", "auto"]} />
            <Tooltip formatter={(v: number) => v?.toLocaleString()} />
            <Legend />
            <Line type="monotone" dataKey="fcf" name="Free cash flow" stroke="#1a365d" strokeWidth={2} dot connectNulls />
            <Line type="monotone" dataKey="ni" name="Net income" stroke="#64748b" strokeWidth={2} dot connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs font-normal text-gray-500">
        Five-year series sourced from seeded placeholders where FY labels align with ingest metric keys.
      </p>
    </div>
  );
}
