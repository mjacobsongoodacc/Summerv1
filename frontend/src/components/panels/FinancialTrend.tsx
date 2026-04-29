import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExtractedValue, SegmentRow } from "../../types";
import { classToColor } from "../../lib/citationColors";

type Mode = "revenue" | "gross_margin" | "operating_margin" | "net_income";

interface Props {
  extractedValues: Record<string, ExtractedValue[]>;
  segments: SegmentRow[];
  loading?: boolean;
}

const YEARS_TREND = [2023, 2024, 2025];

function pick(evMap: Record<string, ExtractedValue[]>, key: string): ExtractedValue | undefined {
  return evMap[key]?.[0];
}

export default function FinancialTrend({ extractedValues, segments, loading = false }: Props) {
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

  const segRows = useMemo(() => segments.filter((s) => s.metric === "revenue"), [segments]);

  const fmt = (v: number | null) =>
    v == null ? "—" : mode === "revenue" || mode === "net_income" ? v.toLocaleString() : `${v.toFixed(2)}%`;
  const hasData = chartData.some((d) => d.value != null);

  return (
    <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-[14px] font-light tracking-wide text-white">
          <span
            className="inline-block h-2 w-2 shrink-0"
            style={{ backgroundColor: classToColor("financial") }}
            aria-hidden
          />
          Financial trend
          <span className="ml-auto text-[11px] text-preview-textDim">Item 8</span>
        </h3>
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
              className={`border border-preview-chromeBorder px-2 py-1 text-[11px] ${
                mode === k ? "text-white border-white" : "text-preview-textDim"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[240px] w-full border border-preview-chromeBorder p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#2F2F2F" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value) => {
                const val = typeof value === "number" ? value : Number(value);
                return [fmt(Number.isFinite(val) ? val : null), mode];
              }}
              contentStyle={{
                backgroundColor: "#2A2A2A",
                border: "1px solid #3A3A3A",
                color: "#E8E8E8",
              }}
            />
            {!loading && hasData && (
              <Line
                type="monotone"
                dataKey="value"
                name={mode}
                stroke={classToColor("financial")}
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
      {!loading && segRows.length > 0 ? (
        <div className="mt-4 border-t border-preview-chromeBorder pt-4">
          <h4 className="mb-2 text-xs font-normal uppercase tracking-[0.04em] text-preview-textDim">
            Segment revenue (FY2025)
          </h4>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.04em] text-preview-textDim">
                <th className="pb-2 font-normal">Segment</th>
                <th className="pb-2 font-normal">Revenue</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {segRows.map((s) => (
                <tr key={s.id} className="border-t border-preview-chromeBorder">
                  <td className="py-2 text-left text-preview-text">{s.segment_name}</td>
                  <td className="py-2">{s.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-[13px] text-preview-textDim">No segment rows available.</div>
      )}
    </article>
  );
}
