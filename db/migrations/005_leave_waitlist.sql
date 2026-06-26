-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  leave_id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  leave_type TEXT NOT NULL, -- 'sick', 'annual', 'family', 'other'
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);
CREATE INDEX IF NOT EXISTS idx_leave_staff ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
