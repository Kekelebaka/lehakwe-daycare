-- Migration 009: Phase 2 — child photos / media (stored in R2 bucket `lehakwe-media`)
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/009_media.sql

CREATE TABLE IF NOT EXISTS media (
  media_id     TEXT PRIMARY KEY,
  child_id     TEXT NOT NULL,
  daily_log_id TEXT,
  r2_key       TEXT NOT NULL,
  content_type TEXT NOT NULL,
  caption      TEXT,
  uploaded_by  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id)
);

CREATE INDEX IF NOT EXISTS idx_media_child ON media(child_id);
CREATE INDEX IF NOT EXISTS idx_media_log ON media(daily_log_id);
