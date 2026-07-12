-- 012_notifications.sql — notification outbox (Phase 2, PR #10)
-- Queues parent-facing notifications (new message, new photo, fee reminder) and
-- tracks delivery. Delivered via the parent's channel (email via Resend now;
-- SMS/WhatsApp/push are pluggable). Additive + forward-only.

CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  parent_id       TEXT,                              -- recipient (nullable = nobody to notify)
  child_id        TEXT,                              -- related child (optional)
  type            TEXT NOT NULL,                      -- 'message' | 'photo' | 'fee_reminder'
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email',      -- resolved delivery channel
  status          TEXT NOT NULL DEFAULT 'pending',    -- pending | sending | sent | failed | skipped
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  dedupe_key      TEXT,                               -- idempotency (e.g. photo:<media_id>, fee:<child>:<YYYY-MM>)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at         TEXT,
  FOREIGN KEY (parent_id) REFERENCES parents(parent_id),
  FOREIGN KEY (child_id) REFERENCES children(child_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_parent ON notifications(parent_id, created_at);
-- Unique dedupe key; SQLite treats NULLs as distinct, so un-keyed rows are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupe_key);
