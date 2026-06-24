-- Phase 2: Attendance, Fees, Notices, Milestones, Waitlist
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/002_phase2.sql

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id            TEXT PRIMARY KEY,
  child_id      TEXT NOT NULL,
  date          TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  status        TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  absence_reason TEXT,
  recorded_by   TEXT,
  synced        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_child ON attendance_records(child_id);

-- Fee Schedules (price list per age group)
CREATE TABLE IF NOT EXISTS fee_schedules (
  schedule_id  TEXT PRIMARY KEY,
  age_group    TEXT NOT NULL,
  monthly_fee  REAL NOT NULL,
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fee Records (per child per month)
CREATE TABLE IF NOT EXISTS fee_records (
  fee_id         TEXT PRIMARY KEY,
  child_id       TEXT NOT NULL,
  schedule_id    TEXT,
  month          INTEGER NOT NULL,
  year           INTEGER NOT NULL,
  amount_due     REAL NOT NULL,
  amount_paid    REAL NOT NULL DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'eft', 'nsnp_subsidy', 'other')),
  payment_date   TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id),
  FOREIGN KEY (schedule_id) REFERENCES fee_schedules(schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_fees_child ON fee_records(child_id);
CREATE INDEX IF NOT EXISTS idx_fees_period ON fee_records(year, month);

-- Notices
CREATE TABLE IF NOT EXISTS notices (
  notice_id    TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('event', 'closure', 'menu', 'general', 'urgent')),
  pinned       INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  expires_at   TEXT,
  photo_url    TEXT,
  author_id    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Developmental Milestones
CREATE TABLE IF NOT EXISTS developmental_milestones (
  milestone_id    TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL,
  milestone_type  TEXT NOT NULL CHECK (milestone_type IN ('3m', '6m', '12m', '18m', '24m', '36m', '48m')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'achieved', 'delayed', 'not_applicable')),
  achieved_date   TEXT,
  notes           TEXT,
  assessed_by     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id)
);

CREATE INDEX IF NOT EXISTS idx_milestones_child ON developmental_milestones(child_id);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  waitlist_id         TEXT PRIMARY KEY,
  child_name          TEXT NOT NULL,
  parent_name         TEXT,
  parent_phone        TEXT,
  parent_email        TEXT,
  age_group           TEXT,
  preferred_start_date TEXT,
  status              TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'contacted', 'enrolled', 'cancelled')),
  notes               TEXT,
  position            INTEGER,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed fee schedules for Lehakwe
INSERT OR IGNORE INTO fee_schedules (schedule_id, age_group, monthly_fee, description) VALUES
  ('fs-infant', 'Infant (0-18m)', 0.0, 'No fee — infants not yet accepted'),
  ('fs-toddler', 'Toddler (1-3 yrs)', 500.0, 'Full day care with meals'),
  ('fs-preschool', 'Preschool (3-5 yrs)', 450.0, 'Full day care with meals and learning'),
  ('fs-aftercare', 'After Care (5-7 yrs)', 350.0, 'After school supervision and snacks');
