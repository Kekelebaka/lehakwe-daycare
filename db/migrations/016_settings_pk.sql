-- 016_settings_pk.sql — Phase 4 PR B: make settings tenant-keyed.
-- Rebuilds settings with a composite PRIMARY KEY (centre_id, setting_key) so every
-- centre keeps its own setting_key namespace. Paired with the tenant-scoped settings
-- upsert (ON CONFLICT(centre_id, setting_key)) shipped in the same PR.
-- Forward-only. Existing rows already carry centre_id (from migration 015).

CREATE TABLE settings_new (
  centre_id     TEXT NOT NULL DEFAULT 'centre-lehakwe',
  setting_key   TEXT NOT NULL,
  setting_value TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  town_id       TEXT,
  PRIMARY KEY (centre_id, setting_key)
);

INSERT INTO settings_new (centre_id, setting_key, setting_value, updated_at, town_id)
  SELECT centre_id, setting_key, setting_value, updated_at, town_id FROM settings;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;

CREATE INDEX IF NOT EXISTS idx_settings_centre ON settings(centre_id);
