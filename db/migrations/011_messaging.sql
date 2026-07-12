-- 011_messaging.sql — two-way parent↔staff messaging (Phase 2, PR #8)
-- One conversation thread per child; messages carry a read receipt (read_at set
-- when the OTHER side opens the thread). Additive + forward-only.

CREATE TABLE IF NOT EXISTS message_threads (
  thread_id        TEXT PRIMARY KEY,
  child_id         TEXT NOT NULL,
  parent_id        TEXT,                       -- the child's parent participant (nullable if unlinked)
  last_message_at  TEXT,                        -- for sorting the thread list
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id),
  FOREIGN KEY (parent_id) REFERENCES parents(parent_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_threads_child ON message_threads(child_id);
CREATE INDEX IF NOT EXISTS idx_msg_threads_parent ON message_threads(parent_id);
CREATE INDEX IF NOT EXISTS idx_msg_threads_recent ON message_threads(last_message_at);

CREATE TABLE IF NOT EXISTS thread_messages (
  message_id   TEXT PRIMARY KEY,
  thread_id    TEXT NOT NULL,
  sender_type  TEXT NOT NULL CHECK (sender_type IN ('staff','parent')),
  sender_id    TEXT NOT NULL,                   -- staff_id or parent_id
  sender_name  TEXT,                            -- denormalised for display
  body         TEXT NOT NULL,
  read_at      TEXT,                            -- when the OTHER side read it (NULL = unread)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES message_threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON thread_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_thread_messages_unread ON thread_messages(thread_id, sender_type, read_at);
