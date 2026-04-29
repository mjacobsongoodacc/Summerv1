import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import type { RiskFactorChange } from "../../types";
import { classToColor } from "../../lib/citationColors";

interface Props {
  changes: RiskFactorChange[];
}

export default function RiskFactorsDiff({ changes }: Props) {
  const grouped = useMemo(() => {
    const g: Record<string, RiskFactorChange[]> = {
      added: [],
      intensified: [],
      unchanged: [],
      removed: [],
    };
    for (const c of changes) {
      g[c.change_type]?.push(c);
    }
    return g;
  }, [changes]);

  const [removedOpen, setRemovedOpen] = useState(false);

  const Row = ({ c }: { c: RiskFactorChange }) => (
    <li className="border-b border-gray-100 py-2 text-sm leading-relaxed text-gray-800 last:border-b-0">
      <span className="mr-2 inline-flex align-middle">
        {c.change_type === "added" && (
          <span className="border border-cite-risk/45 bg-cite-risk/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cite-risk">
            Added
          </span>
        )}
        {c.change_type === "intensified" && (
          <span className="inline-flex items-center gap-1 border border-cite-debt/45 bg-cite-debt/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-cite-debt">
            Intensified
            <TrendingUp className="inline h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          </span>
        )}
      </span>
      {c.factor_text}
    </li>
  );

  return (
    <div className="border border-gray-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 font-light tracking-wide text-gray-900">
        <span
          className="inline-block h-2 w-2 shrink-0"
          style={{ backgroundColor: classToColor("risk") }}
          aria-hidden
        />
        Risk factor delta
      </h3>
      <div className="space-y-6">
        <div>
          <h4 className="mb-2 text-xs font-normal uppercase tracking-wide text-gray-500">Additions</h4>
          <ul>{grouped.added.map((c) => <Row key={c.id} c={c} />)}</ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-normal uppercase tracking-wide text-gray-500">
            Intensified
          </h4>
          <ul>{grouped.intensified.map((c) => <Row key={c.id} c={c} />)}</ul>
        </div>
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-gray-600"
            onClick={() => setRemovedOpen((v) => !v)}
          >
            <span>
              Removed ({grouped.removed.length})
            </span>
            {removedOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.75} aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" strokeWidth={1.75} aria-hidden />
            )}
          </button>
          {removedOpen && (
            <ul className="mt-2 opacity-90">
              {grouped.removed.map((c) => (
                <li key={c.id} className="border-b border-gray-100 py-2 text-sm text-gray-600 last:border-b-0">
                  {c.factor_text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
