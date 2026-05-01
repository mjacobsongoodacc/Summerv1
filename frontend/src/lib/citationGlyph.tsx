import type { ReactElement } from "react";
import type { CiteCategory } from "./citationColors";
import { classToColor } from "./citationColors";

export type SubState =
  | "added"
  | "intensified"
  | "removed"
  | "increasing"
  | "decreasing"
  | "flat"
  | "neutral";

const SUB_STATES: ReadonlySet<string> = new Set<SubState>([
  "added",
  "intensified",
  "removed",
  "increasing",
  "decreasing",
  "flat",
  "neutral",
]);

export function normalizeSubState(raw: unknown): SubState {
  if (typeof raw !== "string" || !SUB_STATES.has(raw)) return "neutral";
  return raw as SubState;
}

export function getGlyph(subState: SubState): string | null {
  switch (subState) {
    case "increasing":
      return "▲";
    case "decreasing":
      return "▼";
    case "flat":
      return "—";
    default:
      return null;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function citeLabelColor(category: CiteCategory): string {
  const { r, g, b } = hexToRgb(classToColor(category));
  return `rgba(${r}, ${g}, ${b}, 0.7)`;
}

/** SVG dot shape only (no directional glyph); glyphs render beside via `getGlyph`. */
export function renderDotSVG(category: CiteCategory, subState: SubState): ReactElement {
  const fill = classToColor(category);
  const { r, g, b } = hexToRgb(fill);
  const removedStroke = `rgba(${r}, ${g}, ${b}, 0.5)`;

  switch (subState) {
    case "removed":
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className="shrink-0">
          <circle cx={5} cy={5} r={4.25} fill="none" stroke={removedStroke} strokeWidth={1.5} />
        </svg>
      );
    case "intensified":
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className="shrink-0">
          <path
            fill={fill}
            fillRule="evenodd"
            d="M 5 0 A 5 5 0 1 1 5 10 A 5 5 0 1 1 5 0 Z M 5 2.5 A 2.5 2.5 0 1 0 5 7.5 A 2.5 2.5 0 1 0 5 2.5 Z"
          />
        </svg>
      );
    case "added":
    case "increasing":
    case "decreasing":
    case "flat":
    case "neutral":
    default:
      return (
        <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden className="shrink-0">
          <circle cx={5} cy={5} r={5} fill={fill} />
        </svg>
      );
  }
}

/** Dot SVG plus directional ▲▼— when applicable (8px glyph, 8px gap). */
export function renderDotWithGlyph(category: CiteCategory, subState: SubState): ReactElement {
  const glyph = getGlyph(subState);
  const dotColor = classToColor(category);
  return (
    <span className="flex items-center justify-center">
      {renderDotSVG(category, subState)}
      {glyph ? (
        <span className="ml-2 shrink-0 font-sans text-[8px] leading-none" style={{ color: dotColor }}>
          {glyph}
        </span>
      ) : null}
    </span>
  );
}
