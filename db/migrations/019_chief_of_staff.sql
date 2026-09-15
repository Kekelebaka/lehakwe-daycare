-- 019_chief_of_staff.sql — Add Chief of Staff admin user for new daycare provisioning.
-- Additive + idempotent (INSERT OR IGNORE, guarded UPDATE on password).
-- Apply: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/019_chief_of_staff.sql

INSERT OR IGNORE INTO staff (staff_id, full_name, job_title, email, password_hash, active, centre_id, created_at, updated_at)
VALUES (
  'staff-chief-of-staff-001',
  'Dorcas Mabuza',
  'Daycare Principal',
  'Dmakhu@gmail.com',
  'hklUGLTrmf7x_KpdFA5FSQ:RerAaovecs3qashEyf5WZop3ZGHtC7PKT3CJwqviFg8:100000',
  1,
  'centre-lehakwe',
  datetime('now'),
  datetime('now')
);

-- If the row already exists, ensure password and role are current.
UPDATE staff
   SET password_hash = 'hklUGLTrmf7x_KpdFA5FSQ:RerAaovecs3qashEyf5WZop3ZGHtC7PKT3CJwqviFg8:100000',
       job_title = 'Daycare Principal',
       active = 1,
       updated_at = datetime('now')
 WHERE lower(email) = 'dmakhu@gmail.com';
