-- Migration 010: Phase 2 — parent OTP login
-- Parents sign in with a one-time code sent to their phone/email (matched to the
-- parents table). Codes are stored hashed, short-lived, single-use, attempt-capped.
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/010_parent_auth.sql

CREATE TABLE IF NOT EXISTS otp_codes (
  otp_id      TEXT PRIMARY KEY,
  identifier  TEXT NOT NULL,                 -- normalized phone or email (lowercased)
  channel     TEXT NOT NULL,                 -- 'email' | 'sms'
  code_hash   TEXT NOT NULL,                 -- sha256(code + secret)
  parent_id   TEXT,                          -- resolved parent (nullable)
  purpose     TEXT NOT NULL DEFAULT 'parent_login',
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier);
