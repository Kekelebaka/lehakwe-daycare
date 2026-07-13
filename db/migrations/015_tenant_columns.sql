-- 015_tenant_columns.sql — Phase 4 PR A: add centre_id to every tenant-owned table.
-- The DEFAULT backfills ALL existing rows to centre #1 (Lehakwe) in one metadata op.
-- Additive + forward-only. INERT until PR B scopes queries by centre_id.
--
-- NOTE: settings gets centre_id as a plain additive column here; its PK stays
-- setting_key in PR A. The composite (centre_id, setting_key) rebuild lands in PR B
-- together with the tenant-scoped settings upsert, so there is no breaking window
-- between the PR A and PR B deploys.
--
-- NOT tenant-scoped (shared reference / global): funding_opportunities, ai_templates,
-- templates, town_config, users, centres, centre_domains.

ALTER TABLE staff                    ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE parents                  ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE children                 ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE attendance_records       ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE fee_schedules            ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE fee_records              ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE payslips                 ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE payslip_items            ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE daily_logs               ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE developmental_milestones ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE leave_requests           ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE waitlist                 ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE notices                  ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE inbox_messages           ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE email_replies            ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE inbox_notes              ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE documents                ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE compliance_items         ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE monthly_reports          ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE generated_docs           ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE media                    ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE otp_codes                ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE message_threads          ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE thread_messages          ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE notifications            ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE funding_applications     ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE audit_logs               ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';
ALTER TABLE settings                 ADD COLUMN centre_id TEXT NOT NULL DEFAULT 'centre-lehakwe';

-- Tenant indexes (leading centre_id) for hot query paths.
CREATE INDEX IF NOT EXISTS idx_children_centre        ON children(centre_id);
CREATE INDEX IF NOT EXISTS idx_staff_centre           ON staff(centre_id);
CREATE INDEX IF NOT EXISTS idx_parents_centre         ON parents(centre_id);
CREATE INDEX IF NOT EXISTS idx_attendance_centre      ON attendance_records(centre_id, date);
CREATE INDEX IF NOT EXISTS idx_fee_records_centre     ON fee_records(centre_id, year, month);
CREATE INDEX IF NOT EXISTS idx_daily_logs_centre      ON daily_logs(centre_id, log_date);
CREATE INDEX IF NOT EXISTS idx_media_centre           ON media(centre_id);
CREATE INDEX IF NOT EXISTS idx_notices_centre         ON notices(centre_id);
CREATE INDEX IF NOT EXISTS idx_msg_threads_centre     ON message_threads(centre_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_centre ON thread_messages(centre_id);
CREATE INDEX IF NOT EXISTS idx_notifications_centre   ON notifications(centre_id);
CREATE INDEX IF NOT EXISTS idx_funding_apps_centre    ON funding_applications(centre_id);
CREATE INDEX IF NOT EXISTS idx_documents_centre       ON documents(centre_id);
CREATE INDEX IF NOT EXISTS idx_compliance_centre      ON compliance_items(centre_id);
CREATE INDEX IF NOT EXISTS idx_audit_centre           ON audit_logs(centre_id);
