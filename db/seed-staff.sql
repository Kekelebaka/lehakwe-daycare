-- wrangler d1 execute lehakwe-db --file=./db/seed-staff.sql --remote
INSERT OR IGNORE INTO staff (id, name, email, signature, role, active) VALUES
  ('staff-nolaphamo-001','Nolaphamo Rakabee','nolaphamorakabee@gmail.com','Nolaphamo Rakabee
Lehakwe Daycare
061 549 1701 | info@lehakwedaycare.co.za
12625 Phase 6, Bloemside 9323','admin',1),
  ('staff-sophy-001','Sophy Lebaka','sophylebaka@gmail.com','Sophy Lebaka
Lehakwe Daycare
061 549 1701 | info@lehakwedaycare.co.za
12625 Phase 6, Bloemside 9323','staff',1);
