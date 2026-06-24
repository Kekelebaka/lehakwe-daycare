CREATE TABLE IF NOT EXISTS daily_logs (
  log_id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  log_date TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'feeding', 'sleep', 'diaper', 'milestone', 'general'
  description TEXT NOT NULL,
  mood TEXT, -- 'happy', 'sad', 'tired', 'sick', 'normal'
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(child_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_child ON daily_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
