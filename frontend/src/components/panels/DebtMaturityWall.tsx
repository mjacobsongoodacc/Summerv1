import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DebtMaturityRow } from "../../types";
import { classToColor } from "../../lib/citationColors";

interface Props {
  debts: DebtMaturityRow[];
  loading?: boolean;
}

export default function DebtMaturityWall({ debts, loading = false }: Props) {
  const chartData = useMemo(
    () =>
      [...debts]
        .sort((a, b) => a.maturity_year - b.maturity_year)
        .map((d) => ({
          year: String(d.maturity_year),
          principal: d.principal,
          rate: d.interest_rate,
        })),
    [debts],
  );

  const totals = useMemo(() => {
    if (debts.length === 0) {
      return { totalDebt: "—", wavg: "—" };
    }
    const total = debts.reduce((s, d) => s + d.principal, 0);
    let weighted = 0;
    for (const d of debts) {
      const r = d.interest_rate ?? 0;
      weighted += d.principal * r;
    }
    const wavg = total > 0 ? weighted / total : 0;
    return { totalDebt: total.toLocaleString(), wavg: `${wavg.toFixed(2)}%` };
  }, [debts]);

  const hasData = chartData.length > 0;
  const chartColor = classToColor("debt");

  return (
    <article className="border border-preview-chromeBorder bg-preview-chrome p-6">
      <h3 className="mb-4 flex items-center gap-2 text-[14px] font-light tracking-wide text-white">
        <span className="inline-block h-2 w-2 shrink-0" style={{ backgroundColor: chartColor }} aria-hidden />
        Debt maturity wall
        <span className="ml-auto text-[11px] text-preview-textDim">Item 15</span>
      </h3>
      <div className="mb-4 grid grid-cols-2 gap-4 text-[13px] font-mono tabular-nums">
        <div className="border border-preview-chromeBorder bg-preview-chrome p-3">
          <div className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">Total principal</div>
          <div className="mt-1 text-[22px] text-white">{loading ? "—" : totals.totalDebt}</div>
        </div>
        <div className="border border-preview-chromeBorder bg-preview-chrome p-3">
          <div className="text-[11px] uppercase tracking-[0.04em] text-preview-textDim">Weighted avg coupon</div>
          <div className="mt-1 text-[22px] text-white">{loading ? "—" : totals.wavg}</div>
        </div>
      </div>
      <div className="relative h-[240px] w-full border border-preview-chromeBorder p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="#2F2F2F" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} tickLine={false} />
            <Tooltip
              formatter={(val: number) => [val.toLocaleString(), "Principal"]}
              contentStyle={{
                backgroundColor: "#2A2A2A",
                border: "1px solid #3A3A3A",
                color: "#E8E8E8",
              }}
            />
            {loading || !hasData ? null : <Bar dataKey="principal" fill={chartColor} />}
          </BarChart>
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
