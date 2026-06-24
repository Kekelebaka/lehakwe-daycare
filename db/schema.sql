-- Lehakwe Daycare Manager D1 Database Schema
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/schema.sql

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS monthly_reports;
DROP TABLE IF EXISTS compliance_items;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS children;
DROP TABLE IF EXISTS parents;
DROP TABLE IF EXISTS inbox_notes;
DROP TABLE IF EXISTS email_replies;
DROP TABLE IF EXISTS inbox_messages;
DROP TABLE IF EXISTS payslip_items;
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'support')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id                  TEXT PRIMARY KEY,
  full_name                 TEXT NOT NULL,
  id_number                 TEXT,
  employee_number           TEXT,
  job_title                 TEXT NOT NULL,
  email                     TEXT,
  phone                     TEXT,
  start_date                TEXT,
  basic_salary              REAL NOT NULL DEFAULT 0.0,
  uif_enabled               INTEGER NOT NULL DEFAULT 1,
  paye_enabled              INTEGER NOT NULL DEFAULT 0,
  active                    INTEGER NOT NULL DEFAULT 1,
  signature                 TEXT DEFAULT 'Kind regards,\n\n[Staff Name]\nLehakwe Daycare\ninfo@lehakwedaycare.co.za\nwww.lehakwedaycare.co.za',
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  notes                     TEXT,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payslips (
  payslip_id       TEXT PRIMARY KEY,
  staff_id         TEXT NOT NULL,
  pay_period_month INTEGER NOT NULL,
  pay_period_year  INTEGER NOT NULL,
  payment_date     TEXT,
  gross_pay        REAL NOT NULL DEFAULT 0.0,
  total_deductions REAL NOT NULL DEFAULT 0.0,
  net_pay          REAL NOT NULL DEFAULT 0.0,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'emailed', 'paid')),
  prepared_by      TEXT,
  generated_at     TEXT,
  emailed_at       TEXT,
  paid_at          TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS payslip_items (
  item_id    TEXT PRIMARY KEY,
  payslip_id TEXT NOT NULL,
  item_type  TEXT NOT NULL CHECK (item_type IN ('earning', 'deduction')),
  item_name       TEXT NOT NULL,
  amount     REAL NOT NULL,
  FOREIGN KEY (payslip_id) REFERENCES payslips(payslip_id)
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  message_id      TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL,
  from_email      TEXT NOT NULL,
  from_name       TEXT,
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL DEFAULT '(no subject)',
  body_text       TEXT,
  body_html       TEXT,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'replied', 'closed')),
  assigned_to     TEXT,
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_replied_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_replies (
  reply_id       TEXT PRIMARY KEY,
  thread_id      TEXT NOT NULL,
  staff_id       TEXT,
  body           TEXT NOT NULL,
  sent_to        TEXT NOT NULL,
  signature_used TEXT,
  sent_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES inbox_messages(thread_id)
);

CREATE TABLE IF NOT EXISTS inbox_notes (
  note_id    TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  staff_id   TEXT,
  note       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES inbox_messages(thread_id)
);

CREATE TABLE IF NOT EXISTS parents (
  parent_id             TEXT PRIMARY KEY,
  full_name             TEXT NOT NULL,
  phone                 TEXT,
  email                 TEXT,
  address               TEXT,
  relationship_to_child TEXT,
  emergency_contact     INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  child_id                    TEXT PRIMARY KEY,
  full_name                   TEXT NOT NULL,
  date_of_birth               TEXT,
  age_group                   TEXT,
  enrolment_date              TEXT,
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
  parent_id                   TEXT,
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  medical_notes               TEXT,
  allergies                   TEXT,
  pickup_authorisation_notes  TEXT,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES parents(parent_id)
);

CREATE TABLE IF NOT EXISTS documents (
  document_id       TEXT PRIMARY KEY,
  related_entity_type TEXT NOT NULL,
  related_entity_id   TEXT NOT NULL,
  document_type       TEXT NOT NULL,
  title               TEXT NOT NULL,
  expiry_date         TEXT,
  file_url            TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
  uploaded_at         TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by         TEXT
);

CREATE TABLE IF NOT EXISTS compliance_items (
  compliance_id TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  item_name     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('complete', 'needs_attention', 'missing', 'expired')),
  expiry_date   TEXT,
  notes         TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  report_id   TEXT PRIMARY KEY,
  month       INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by TEXT,
  data_json   TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id    TEXT PRIMARY KEY,
  user_id     TEXT,
  action      TEXT NOT NULL,
  module_name TEXT NOT NULL,
  record_id   TEXT,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now')),
  metadata    TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payslips_staff ON payslips(staff_id);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(pay_period_year, pay_period_month);
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_messages(status);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module_name, record_id);

-- Seed default compliance items
INSERT OR IGNORE INTO compliance_items (compliance_id, category, item_name, status) VALUES
  ('comp-1', 'Centre', 'Centre Registration Certificate', 'needs_attention'),
  ('comp-2', 'Centre', 'NPO Registration Documents', 'needs_attention'),
  ('comp-3', 'Centre', 'Health Clearance Certificate', 'needs_attention'),
  ('comp-4', 'Centre', 'Fire/Safety Compliance', 'needs_attention'),
  ('comp-5', 'Staff', 'Staff ID Copies (All)', 'missing'),
  ('comp-6', 'Staff', 'Staff Contracts (All)', 'missing'),
  ('comp-7', 'Children', 'Child Registration Forms', 'missing'),
  ('comp-8', 'Children', 'Parent Consent Forms', 'missing'),
  ('comp-9', 'Children', 'Emergency Contacts Verified', 'missing'),
  ('comp-10', 'Admin', 'Attendance Records Up to Date', 'needs_attention'),
  ('comp-11', 'Admin', 'Payslip Records Up to Date', 'needs_attention');

-- Seed default settings
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES
  ('daycare_name', 'Lehakwe Daycare'),
  ('daycare_address', '12625 Phase 6, Bloemfontein'),
  ('npo_number', '22910695'),
  ('website', 'https://lehakwedaycare.co.za'),
  ('official_email', 'info@lehakwedaycare.co.za'),
  ('uif_enabled', 'true'),
  ('paye_enabled', 'false');
