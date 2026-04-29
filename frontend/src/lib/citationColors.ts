export type CiteCategory = "risk" | "financial" | "debt" | "fcf" | "sbc" | "insurance";

/** Alias for cite-class keyed helpers (risk diffs elsewhere use distinct colors). */
export type CitationClass = CiteCategory;

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
