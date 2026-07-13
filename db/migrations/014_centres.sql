-- 014_centres.sql — Phase 4 PR A: tenant registry.
-- Additive + forward-only. INERT until PR B wires tenant scoping into the worker.
-- Apply to every instance DB (lehakwe-db + the demo DB) at deploy.

CREATE TABLE IF NOT EXISTS centres (
  centre_id      TEXT PRIMARY KEY,
  slug           TEXT UNIQUE,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing','active','suspended')),
  plan           TEXT NOT NULL DEFAULT 'self_service',
  mode           TEXT NOT NULL DEFAULT 'pooled' CHECK (mode IN ('pooled','isolated')),
  db_id          TEXT,                 -- isolated tenants only
  owner_staff_id TEXT,
  logo_url       TEXT,
  primary_color  TEXT,
  province       TEXT,
  npo_number     TEXT,
  municipality   TEXT,
  address        TEXT,
  official_email TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS centre_domains (
  host       TEXT PRIMARY KEY,          -- subdomain or custom domain
  centre_id  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id)
);
CREATE INDEX IF NOT EXISTS idx_centre_domains_centre ON centre_domains(centre_id);

-- Seed centre #1 from THIS instance's existing settings
-- (→ "Lehakwe Daycare" on prod, "Ubuntu Demo Daycare" on the demo DB, since settings
--  are already populated before this migration runs).
INSERT OR IGNORE INTO centres (centre_id, slug, name, status, plan, mode, province, npo_number, municipality, address, official_email)
VALUES (
  'centre-lehakwe', 'lehakwe',
  COALESCE((SELECT setting_value FROM settings WHERE setting_key='daycare_name'), 'Lehakwe Daycare'),
  'active', 'self_service', 'pooled',
  (SELECT setting_value FROM settings WHERE setting_key='province'),
  (SELECT setting_value FROM settings WHERE setting_key='npo_number'),
  (SELECT setting_value FROM settings WHERE setting_key='municipality'),
  (SELECT setting_value FROM settings WHERE setting_key='daycare_address'),
  (SELECT setting_value FROM settings WHERE setting_key='official_email')
);

INSERT OR IGNORE INTO centre_domains (host, centre_id) VALUES
  ('app.lehakwedaycare.co.za', 'centre-lehakwe'),
  ('lehakwe.daycareos.ubuntutown.co.za', 'centre-lehakwe');
