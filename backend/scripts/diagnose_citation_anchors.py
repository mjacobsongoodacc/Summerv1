#!/usr/bin/env python3
"""
Diagnose offset-based citation anchoring vs rendered DOM text.

Run from backend root (requires SUPABASE_* in .env):
  python scripts/diagnose_citation_anchors.py [ticker]

Prints:
- Sample extracted_values + risk_factor_changes with char slices from cleaned_html
- Whether HTML "source plain" length model matches decoded text length (entity skew)
- Which citations would fail wrap (optional; requires jsdom or manual review)

For each sample row, shows cleaned_html[char_start:char_end] and paragraph_text head.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def source_plain_length_and_text(html: str) -> tuple[int, str]:
    """Mirror DocumentView: characters outside <...> tags, raw (entities count as multiple chars)."""
    out: list[str] = []
    i = 0
    n = len(html)
    while i < n:
        if html[i] == "<":
            close = html.find(">", i + 1)
            if close == -1:
                break
            i = close + 1
            continue
        out.append(html[i])
        i += 1
    return len(out), "".join(out)


def decoded_visible_text(html: str) -> str:
    """Approximate browser visible text without bs4: strip tags, unescape."""
    from html import unescape

    text = re.sub(r"<[^>]+>", "", html)
    return unescape(re.sub(r"\s+", " ", text)).strip()


def main() -> None:
    ticker = (sys.argv[1] if len(sys.argv) > 1 else "PGR").strip().upper()

    try:
        from supabase_client import supabase  # noqa: PLC0415
    except (RuntimeError, ImportError) as e:
        print("Cannot load Supabase:", e)
        print("\n--- Static diagnosis (no DB) ---")
        demo_entity_skew()
        return

    res = (
        supabase.table("filings")
        .select("id, cleaned_html, period_end_date, section_index")
        .eq("ticker", ticker)
        .eq("filing_type", "10-K")
        .order("period_end_date", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        print(f"No filing for {ticker}")
        demo_entity_skew()
        return

    row = rows[0]
    fid = row["id"]
    html = row.get("cleaned_html") or ""
    print(f"Filing {ticker} id={fid} period={row.get('period_end_date')} html_len={len(html)}")

    spl, spt = source_plain_length_and_text(html)
    dvt = decoded_visible_text(html)
    print(f"\n=== Global length check ===")
    print(f"Source-plain char count (tag-stripped, raw entities): {spl}")
    print(f"Approx decoded visible text len (BS4 get_text + unescape + collapse ws): {len(dvt)}")
    print(f"Delta (expected negative if entities compress): {spl - len(dvt)}")

    ev_res = supabase.table("extracted_values").select("*").eq("filing_id", fid).execute()
    evs = ev_res.data or []
    rfc_res = (
        supabase.table("risk_factor_changes").select("*").eq("ticker", ticker).eq("to_filing_id", fid).execute()
    )
    rfcs = rfc_res.data or []

    def section_anchor_for_char(pos: int) -> str:
        try:
            si = row.get("section_index") or []
            if not isinstance(si, list):
                return "?"
            for ent in si:
                cs = int(ent.get("char_start") or 0)
                ce = int(ent.get("char_end") or 10**9)
                if cs <= pos <= ce:
                    return str(ent.get("anchor", ""))
        except (TypeError, ValueError):
            pass
        return "?"

    print("\n=== Three extracted_values samples (first 3 rows) ===")
    for r in evs[:3]:
        cs, ce = int(r["char_start"]), int(r["char_end"])
        sl = html[cs:ce] if 0 <= cs <= len(html) and ce <= len(html) else "<out of range>"
        print(f"\nid={r['id']}")
        print(f"  metric_key={r.get('metric_key')}")
        print(f"  char_start={cs} char_end={ce} section_anchor~={section_anchor_for_char(cs)}")
        print(f"  slice repr (first 200): {sl[:200]!r}")
        print(f"  paragraph_text head: {str(r.get('paragraph_text', ''))[:120]!r}")

    print("\n=== Three risk_factor_changes samples (first 3 to_filing) ===")
    for r in rfcs[:3]:
        cs = r.get("char_start")
        ce = r.get("char_end")
        if cs is None or ce is None:
            print(f"\nid={r['id']} change_type={r.get('change_type')} char_start/end NULL — no offset slice")
            print(f"  factor_text head: {str(r.get('factor_text', ''))[:120]!r}")
            continue
        cs, ce = int(cs), int(ce)
        sl = html[cs:ce] if 0 <= cs <= len(html) and ce <= len(html) else "<out of range>"
        print(f"\nid={r['id']} change_type={r.get('change_type')}")
        print(f"  char_start={cs} char_end={ce} section_anchor~={section_anchor_for_char(cs)}")
        print(f"  slice repr (first 200): {sl[:200]!r}")
        print(f"  factor_text head: {str(r.get('factor_text', ''))[:120]!r}")

    print("\n=== Hypothesis ===")
    print(
        "If source-plain length >> decoded text length, HTML entities (&nbsp;, &amp;, …) break\n"
        "the mapping from DB char offsets (HTML source indices) to browser text-node positions\n"
        "used by wrapPlainTextRange(). Offsets can also be wrong if row_html.find() misses or\n"
        "concatenated annual report shifts indices. Content-based anchoring avoids this."
    )

    demo_entity_skew()


def demo_entity_skew() -> None:
    print("\n--- Toy example: entity skew ---")
    sample = "<p>If we are unable to obtain c&amp;al is to maximize</p>"
    spl, spt = source_plain_length_and_text(sample)
    # Strip tags naively for "visible" text approximation without bs4
    import re as _re

    inner = _re.sub(r"<[^>]+>", "", sample)
    from html import unescape

    visible = unescape(inner)
    print(f"HTML: {sample!r}")
    print(f"Source-plain len={spl} text={spt!r}")
    print(f"Regex strip tags + html.unescape len={len(visible)} text={visible!r}")
    print("DocumentView maps DB offsets using source-plain walk; browser uses decoded text nodes.")


if __name__ == "__main__":
    main()
