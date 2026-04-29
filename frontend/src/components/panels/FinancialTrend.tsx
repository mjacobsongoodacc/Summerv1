import { useMemo, useState } from "react";
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
import type { ExtractedValue, SegmentRow } from "../../types";

type Mode = "revenue" | "gross_margin" | "operating_margin" | "net_income";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
  segments: SegmentRow[];
}

const YEARS_TREND = [2023, 2024, 2025];

function pick(evMap: Record<string, ExtractedValue[]>, key: string): ExtractedValue | undefined {
  return evMap[key]?.[0];
}

export default function FinancialTrend({ extractedValues, segments }: Props) {
  const [mode, setMode] = useState<Mode>("revenue");

  const chartData = useMemo(() => {
    const prefix =
      mode === "revenue"
        ? "net_premiums_fy"
        : mode === "gross_margin"
          ? "gross_margin_fy"
          : mode === "operating_margin"
            ? "operating_margin_fy"
            : "net_income_fy";

    return YEARS_TREND.map((y) => {
      const ev = pick(extractedValues, `${prefix}${y}`);
      const v = ev?.value_numeric ?? null;
      return {
        year: String(y),
        value: v != null ? Number(v) : null,
      };
    });
  }, [extractedValues, mode]);

  const fmt = (v: number | null) =>
    v == null ? "—" : mode === "revenue" || mode === "net_income" ? v.toLocaleString() : `${v.toFixed(2)}%`;

  const segRows = useMemo(() => segments.filter((s) => s.metric === "revenue"), [segments]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-light tracking-wide text-carnegie-navy">Financial trend</h3>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["revenue", "Net premiums"],
              ["gross_margin", "Gross margin"],
              ["operating_margin", "Op margin"],
              ["net_income", "Net income"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`rounded-full border px-3 py-1 text-xs font-normal ${
                mode === k
                  ? "border-carnegie-navy bg-carnegie-navy text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value) => {
                const val = typeof value === "number" ? value : Number(value);
                return [fmt(Number.isFinite(val) ? val : null), mode];
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="value" name={mode} stroke="#1a365d" strokeWidth={2} dot connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <h4 className="mb-2 text-xs font-normal uppercase tracking-wide text-gray-500">
          Segment revenue (FY2025)
        </h4>
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="pb-2 font-normal">Segment</th>
              <th className="pb-2 font-normal">Revenue</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {segRows.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="py-2 text-left text-gray-800">{s.segment_name}</td>
                <td className="py-2">{s.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
