import type { RiskFactorChange, SectionIndexEntry } from "../types";

export type CiteCategory = "risk" | "financial" | "debt" | "fcf" | "sbc" | "insurance";

/** Alias for cite-class keyed helpers (risk diffs elsewhere use distinct colors). */
export type CitationClass = CiteCategory;

export type CitationLike = {
  charStart: number;
  charEnd: number;
  category: CiteCategory;
};

/** Lexical char span from the filings API — invalid if missing endpoints or bogus negatives. */
function hasValidLexicalSpan(charStart: number, charEnd: number): boolean {
  return charEnd > charStart && charStart >= 0 && charEnd >= 0;
}

/** Risk-only listings when we only have anchor hash/text (offsets null / sentinels — e.g. -1). */
function anchorOnlyRiskMatchesSection(section: SectionIndexEntry): boolean {
  const name = (section.name ?? "").trim();
  const anchor = (section.anchor ?? "").toLowerCase();
  const lowerName = name.toLowerCase();

  const nameMatches =
    /^item\s+1\s*a\b/i.test(lowerName) ||
    /\brisks?\b/.test(lowerName) ||
    /\brisk\s+factor\b/i.test(lowerName) ||
    /^part\s+i\b(?=\s|,|\.)/i.test(lowerName);

  const slug = anchor.replace(/^#/, "");
  const anchorMatches =
    /(^|[^\w])(item[-_]1[-_]a|item1a)([^\w]|$)/i.test(slug) ||
    /(^|[^\w])(risk[-_]factors?)([^\w]|$)/i.test(slug);

  return nameMatches || anchorMatches;
}

/** True when citation span overlaps section char range [char_start char_end]. */
export function overlapsSectionCitation(
  section: SectionIndexEntry,
  charStart: number,
  charEnd: number,
): boolean {
  if (!hasValidLexicalSpan(charStart, charEnd)) return false;
  const cs = section.char_start ?? 0;
  const ce = section.char_end ?? Number.MAX_SAFE_INTEGER;
  return charStart <= ce && charEnd >= cs;
}

/** Citations whose span overlaps `section`, filtered by toolbar category toggles. */
export function citationsForSection<T extends CitationLike>(
  section: SectionIndexEntry,
  citations: readonly T[],
  enabledCategories: Record<CiteCategory, boolean>,
): T[] {
  return citations.filter((c) => {
    if (!enabledCategories[c.category]) return false;
    if (hasValidLexicalSpan(c.charStart, c.charEnd)) {
      return overlapsSectionCitation(section, c.charStart, c.charEnd);
    }
    if (c.category === "risk") {
      return anchorOnlyRiskMatchesSection(section);
    }
    return false;
  });
}

/** Prefix tag for risk factor change lines (+ / Δ / −) with cite-class-aligned colors. */
export function riskFactorChangePrefix(
  changeType: RiskFactorChange["change_type"] | undefined,
): { symbol: string; className: string } | null {
  switch (changeType) {
    case "added":
      return { symbol: "+", className: "text-cite-fcf" };
    case "intensified":
      return { symbol: "Δ", className: "text-cite-debt" };
    case "removed":
      return { symbol: "−", className: "text-cite-risk" };
    default:
      return null;
  }
}

const PALETTE: Record<CiteCategory, string> = {
  risk: "#E55E5E",
  financial: "#5EB3E5",
  debt: "#E5A85E",
  fcf: "#7AB87A",
  sbc: "#A878C8",
  insurance: "#5AC8FA",
};

export function metricKeyToClass(key: string): CiteCategory {
  const k = key.toLowerCase();
  if (
    k.includes("combined_ratio") ||
    k.includes("loss_ratio") ||
    k.includes("expense_ratio") ||
    k.includes("portfolio_yield") ||
    k.includes("duration") ||
    k.includes("reserve_development") ||
    k.startsWith("insurance_")
  ) {
    return "insurance";
  }
  if (k.startsWith("free_cash_flow_") || k.startsWith("operating_cash_flow_") || k.includes("fcf")) {
    return "fcf";
  }
  if (k.startsWith("sbc_") || k.includes("stock_based_comp") || k.includes("sbc_pct_ocf")) {
    return "sbc";
  }
  if (k.startsWith("debt_") || k.includes("maturity_") || k.includes("debt")) {
    return "debt";
  }
  if (
    k.startsWith("net_premiums_") ||
    k.startsWith("gross_margin_") ||
    k.startsWith("operating_margin_") ||
    k.startsWith("net_income_") ||
    k.startsWith("investment_income_") ||
    k.startsWith("net_realized_gains_") ||
    k.includes("capital")
  ) {
    return "financial";
  }
  return "financial";
}

export function classToColor(cls: CiteCategory): string {
  return PALETTE[cls];
}

/** 12% opacity background tint for inline source-viewer highlights */
export function classToTint(cls: CitationClass): string {
  const map: Record<CitationClass, string> = {
    risk: "rgba(255, 59, 48, 0.12)",
    financial: "rgba(10, 132, 255, 0.12)",
    debt: "rgba(255, 149, 0, 0.12)",
    fcf: "rgba(48, 209, 88, 0.12)",
    sbc: "rgba(191, 90, 242, 0.12)",
    insurance: "rgba(90, 200, 250, 0.12)",
  };
  return map[cls];
}

/** 22% opacity hover state for inline highlights */
export function classToTintHover(cls: CitationClass): string {
  const map: Record<CitationClass, string> = {
    risk: "rgba(255, 59, 48, 0.22)",
    financial: "rgba(10, 132, 255, 0.22)",
    debt: "rgba(255, 149, 0, 0.22)",
    fcf: "rgba(48, 209, 88, 0.22)",
    sbc: "rgba(191, 90, 242, 0.22)",
    insurance: "rgba(90, 200, 250, 0.22)",
  };
  return map[cls];
}

export const DEFAULT_FILTER_ENABLED: Record<CiteCategory, boolean> = {
  risk: true,
  financial: true,
  debt: true,
  fcf: true,
  sbc: true,
  insurance: true,
};
