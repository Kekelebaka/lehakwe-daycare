-- seed-staff.sql: Seed initial staff members for Lehakwe Daycare
-- Matches live staff schema (staff_id, full_name, job_title, email, signature, active)
-- NOTE: password_hash must be set via the API or a separate script after deployment
-- wrangler d1 execute lehakwe-db --remote --file=./db/seed-staff.sql

INSERT OR IGNORE INTO staff (staff_id, full_name, job_title, email, phone, basic_salary, uif_enabled, paye_enabled, active, signature) VALUES
  ('staff-nolaphamo-001', 'Nolaphamo Rakabee', 'Centre Manager', 'nolaphamorakabee@gmail.com', '0615491701', 4500, 1, 0, 1,
   'Kind regards,\n\nNolaphamo Rakabee\nLehakwe Daycare\ninfo@lehakwedaycare.co.za\n061 549 1701\n12625 Phase 6, Bloemside 9323'),
  ('staff-sophy-001', 'Sophy Lebaka', 'Caregiver', 'sophylebaka@gmail.com', '0615491701', 4500, 1, 0, 1,
   'Kind regards,\n\nSophy Lebaka\nLehakwe Daycare\ninfo@lehakwedaycare.co.za\n061 549 1701\n12625 Phase 6, Bloemside 9323');
