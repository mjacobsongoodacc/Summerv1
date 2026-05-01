import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** Match backend `ingest.anchor_fields.normalize_paragraph_text` (NBSP → space, then collapse whitespace). */
export function normalizeParagraphText(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/\u2007/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase hex SHA-1 of UTF-8(normalized full paragraph), matching Python hashlib.sha1. */
export function paragraphSha1Hex(normalizedFullParagraph: string): string {
  return bytesToHex(sha1(new TextEncoder().encode(normalizedFullParagraph)));
}
