-- Citation display fields used by the source viewer to render persistent
-- labels and shape-encoded sub-states next to margin dots.
--
-- HOW TO APPLY:
--   1. Open Supabase Studio for the project.
--   2. Navigate to "SQL Editor" → "New query".
--   3. Paste the contents of this file and click Run.
--   4. Confirm the four new columns exist on extracted_values and
--      risk_factor_changes.
--   5. Run python backend/scripts/backfill_display_fields.py to populate
--      display_label / sub_state for existing rows.
--
-- Note on naming: the spec referenced a `risk_deltas` table; in this
-- codebase the equivalent table is `risk_factor_changes` (with column
-- `change_type` instead of `delta_type`). Backfill maps change_type values
-- ("added"/"intensified"/"removed"/"unchanged") onto sub_state.

ALTER TABLE extracted_values
  ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE extracted_values
  ADD COLUMN IF NOT EXISTS sub_state text NOT NULL DEFAULT 'neutral';

ALTER TABLE risk_factor_changes
  ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE risk_factor_changes
  ADD COLUMN IF NOT EXISTS sub_state text NOT NULL DEFAULT 'neutral';
