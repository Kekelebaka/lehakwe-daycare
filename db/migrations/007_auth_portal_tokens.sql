-- Migration 007: Auth + portal security
-- Adds password_hash to staff for JWT login
-- Adds portal_token to children for unguessable QR portal URLs
-- Adds templates table (exists on live but not in any migration)

-- ── STAFF: add password_hash for JWT auth ──
ALTER TABLE staff ADD COLUMN password_hash TEXT;

-- ── CHILDREN: add unguessable portal token ──
ALTER TABLE children ADD COLUMN portal_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_children_portal_token ON children(portal_token);

-- ── TEMPLATES: formally create (already exists on live, this makes it idempotent) ──
CREATE TABLE IF NOT EXISTS templates (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
