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

interface Props {
  debts: DebtMaturityRow[];
}

export default function DebtMaturityWall({ debts }: Props) {
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
    const totalDebt = debts.reduce((s, d) => s + d.principal, 0);
    let weighted = 0;
    for (const d of debts) {
      const r = d.interest_rate ?? 0;
      weighted += d.principal * r;
    }
    const wavg = totalDebt > 0 ? weighted / totalDebt : 0;
    return { totalDebt, wavg };
  }, [debts]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-light tracking-wide text-carnegie-navy">Debt maturity wall</h3>
      <div className="mb-4 grid grid-cols-2 gap-4 font-mono text-sm tabular-nums">
        <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Total principal</div>
          <div>{totals.totalDebt.toLocaleString()}</div>
        </div>
        <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Weighted avg coupon (placeholder)
          </div>
          <div>{totals.wavg.toFixed(2)}%</div>
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip
              formatter={(val: number, name: string) =>
                name === "principal"
                  ? [val.toLocaleString(), "Principal"]
                  : [`${Number(val).toFixed(2)}%`, "Coupon"]
              }
            />
            <Bar dataKey="principal" fill="#1a365d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
