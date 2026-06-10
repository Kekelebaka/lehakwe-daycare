-- Lehakwe Daycare D1 Database Schema
-- Run: wrangler d1 execute lehakwe-db --file=./db/schema.sql

CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email    TEXT NOT NULL,
  from_name     TEXT NOT NULL DEFAULT '',
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL DEFAULT '',
  body_text     TEXT NOT NULL DEFAULT '',
  body_html     TEXT DEFAULT '',
  raw_email_ref TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'replied', 'closed')),
  assigned_to   TEXT DEFAULT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assigned_to) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS staff (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL DEFAULT '',
  role      TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  staff_id   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES messages(thread_id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  staff_id   TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('received', 'forwarded', 'opened', 'assigned', 'replied', 'noted', 'closed')),
  metadata   TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES messages(thread_id),
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_thread ON notes(thread_id);
CREATE INDEX IF NOT EXISTS idx_audit_thread ON audit_logs(thread_id);

-- Reply templates
CREATE TABLE IF NOT EXISTS templates (
  id      TEXT PRIMARY KEY,
  title   TEXT NOT NULL,
  body    TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO templates (id, title, body, sort_order) VALUES
  ('tpl-general', 'General Enquiry',
   'Good day,\n\nThank you for contacting Lehakwe Daycare.\n\nWe have received your enquiry and will gladly assist you. Please share your child''s age and the type of care you are looking for so that we can guide you properly.\n\nKind regards,\n\n[SIGNATURE]',
   1),
  ('tpl-visit', 'Visit Request',
   'Good day,\n\nThank you for your interest in Lehakwe Daycare.\n\nYou are welcome to arrange a visit so that you can see the daycare and ask any questions. Please let us know which day and time would suit you.\n\nKind regards,\n\n[SIGNATURE]',
   2),
  ('tpl-availability', 'Availability Check',
   'Good day,\n\nThank you for contacting Lehakwe Daycare.\n\nPlease send us your child''s age and the date you would like care to start. We will then confirm availability and guide you on the next steps.\n\nKind regards,\n\n[SIGNATURE]',
   3),
  ('tpl-documents', 'Documents Needed',
   'Good day,\n\nThank you for your message.\n\nFor registration, please prepare the required parent and child details. We will confirm the full list of documents with you directly.\n\nKind regards,\n\n[SIGNATURE]',
   4);
