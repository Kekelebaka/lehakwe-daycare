-- Migration 008: Phase 0 hardening
-- Adds an optional expiry to child parent-portal tokens so QR links can be
-- rotated and revoked. NULL = legacy token with no expiry (kept working so this
-- migration is non-breaking); new tokens should set an expiry.
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/008_phase0_hardening.sql

ALTER TABLE children ADD COLUMN portal_token_expires_at TEXT;
