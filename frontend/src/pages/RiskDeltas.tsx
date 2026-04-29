import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppShell } from "../AppContext";
import type { RiskFactorChange } from "../types";
import { classToColor } from "../lib/citationColors";

type FilterKey = RiskFactorChange["change_type"] | "unchanged";

const FILTERS: Array<{
  key: FilterKey;
  label: string;
}> = [
  { key: "added", label: "Added" },
  { key: "intensified", label: "Intensified" },
  { key: "removed", label: "Removed" },
  { key: "unchanged", label: "Unchanged" },
];

function getChipColor(key: FilterKey): string {
  if (key === "added") return classToColor("fcf");
  if (key === "intensified") return classToColor("debt");
  if (key === "removed") return classToColor("risk");
  return "#9A9A9A";
}

function toSourceLink(change: RiskFactorChange): string | null {
  if (!change.to_filing_id) return null;
  const params = new URLSearchParams();
  params.set("citeId", change.id);
  if (change.char_start != null) params.set("start", String(change.char_start));
  if (change.char_end != null) params.set("end", String(change.char_end));
  return `/source/${change.to_filing_id}?${params.toString()}`;
}

const DEFAULT_FILTERS: Record<FilterKey, boolean> = {
  added: true,
  intensified: true,
  removed: true,
  unchanged: false,
};

export default function RiskDeltas() {
  const { data, loading, error } = useAppShell();
  const changes = data?.risk_factor_changes ?? [];

  const counts = useMemo(
    () => ({
      added: changes.filter((item) => item.change_type === "added").length,
      intensified: changes.filter((item) => item.change_type === "intensified").length,
      removed: changes.filter((item) => item.change_type === "removed").length,
      unchanged: changes.filter((item) => item.change_type === "unchanged").length,
    }),
    [changes],
  );

  const [activeFilters, setActiveFilters] = useState<Record<FilterKey, boolean>>(DEFAULT_FILTERS);

  const grouped = useMemo(() => {
    const out: Record<FilterKey, RiskFactorChange[]> = {
      added: [],
      intensified: [],
      removed: [],
      unchanged: [],
    };
    for (const item of changes) {
      out[item.change_type].push(item);
    }
    return out;
  }, [changes]);

  const visibleColumns = FILTERS.filter((filter) => activeFilters[filter.key]);

  const summary = (
    <p className="mt-2 text-[13px] font-mono tabular-nums text-preview-text">
      <span className="text-cite-fcf">{counts.added} ADDED</span>
      <span className="px-1.5 text-preview-textDim">·</span>
      <span className="text-cite-debt">{counts.intensified} INTENSIFIED</span>
      <span className="px-1.5 text-preview-textDim">·</span>
      <span className="text-cite-risk">{counts.removed} REMOVED</span>
      <span className="px-1.5 text-preview-textDim">·</span>
      <span className="text-preview-textDim">{counts.unchanged} UNCHANGED</span>
    </p>
  );

  return (
    <div className="px-8 py-6">
      {error && (
        <div className="mb-6 border-l-[3px] border-cite-risk bg-preview-chrome px-4 py-3 text-[13px] text-preview-text">
          Error loading data: {error}
        </div>
      )}

      <section className="sticky top-0 z-10 bg-preview-bg py-1">
        <h1 className="text-[22px] font-light text-white">Risk Factor Deltas — PGR FY2025 vs FY2024</h1>
        {summary}
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((chip) => {
            const active = activeFilters[chip.key];
            const color = getChipColor(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() =>
                  setActiveFilters((prev) => ({
                    ...prev,
                    [chip.key]: !prev[chip.key],
                  }))
                }
                className="border border-preview-chromeBorder px-3 py-1 text-[13px]"
                style={{
                  backgroundColor: active ? `${color}33` : "transparent",
                  color: active ? color : "#9A9A9A",
                  borderColor: active ? color : "#3A3A3A",
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </section>

      {visibleColumns.length === 0 ? (
        <p className="mt-6 text-[13px] text-preview-textDim">No columns selected.</p>
      ) : (
        <section className={`mt-6 grid gap-6 ${visibleColumns.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {visibleColumns.map((col) => {
            const rows = grouped[col.key];
            const title =
              col.key === "added"
                ? "ADDED"
                : col.key === "intensified"
                  ? "INTENSIFIED"
                  : col.key === "removed"
                    ? "REMOVED"
                    : "UNCHANGED";
            const count = counts[col.key];
            const color = getChipColor(col.key);

            return (
              <div key={col.key} className="space-y-4">
                <div>
                  <h2 className="text-[13px] font-light uppercase tracking-[0.04em]" style={{ color }}>
                    {title}
                  </h2>
                  <p className={`mt-1 text-[24px] font-mono tabular-nums ${col.key === "added" ? "text-cite-fcf" : col.key === "intensified" ? "text-cite-debt" : col.key === "removed" ? "text-cite-risk" : "text-preview-textDim"}`}>
                    {count}
                  </p>
                </div>
                {loading ? (
                  <p className="px-4 py-8 text-[13px] text-preview-textDim">Loading deltas…</p>
                ) : rows.length === 0 ? (
                  <p className="px-4 py-8 text-[13px] text-preview-textDim">No items in this category</p>
                ) : (
                  <div className="space-y-4">
                    {rows.map((item, idx) => {
                      const sourceLink = toSourceLink(item);
                      const itemLabel = `Item ${idx + 1}A`;
                      const footer = (
                        <p className="mt-3 text-[11px] text-preview-textDim">Item {idx + 1}A · Source ›</p>
                      );

                      if (!sourceLink) {
                        return (
                          <article
                            key={item.id}
                            className="block border-y border-r border-preview-chromeBorder bg-preview-chrome p-4"
                            style={{ borderLeft: `3px solid ${color}` }}
                          >
                            <p className="text-[13px] leading-[1.55] text-preview-text">{item.factor_text}</p>
                            {footer}
                          </article>
                        );
                      }

                      return (
                        <Link
                          key={item.id}
                          to={sourceLink}
                          className="block border-y border-r border-preview-chromeBorder bg-preview-chrome p-4"
                          style={{ borderLeft: `3px solid ${color}` }}
                        >
                          <p className="text-[13px] leading-[1.55] text-preview-text">{item.factor_text}</p>
                          <p className="mt-3 text-[11px] text-preview-textDim">{itemLabel} · Source ›</p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
