-- Content-based citation anchors (char offsets retained as legacy fallback only).
ALTER TABLE extracted_values ADD COLUMN IF NOT EXISTS anchor_text text;
ALTER TABLE extracted_values ADD COLUMN IF NOT EXISTS anchor_hash text;
ALTER TABLE risk_factor_changes ADD COLUMN IF NOT EXISTS anchor_text text;
ALTER TABLE risk_factor_changes ADD COLUMN IF NOT EXISTS anchor_hash text;

CREATE INDEX IF NOT EXISTS extracted_values_anchor_hash_idx ON extracted_values (anchor_hash);
CREATE INDEX IF NOT EXISTS risk_factor_changes_anchor_hash_idx ON risk_factor_changes (anchor_hash);
