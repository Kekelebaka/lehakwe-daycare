-- seed-demo.sql — Ubuntu Daycare OS DEMO instance seed ("Ubuntu Demo Daycare")
-- Apply to a FRESH demo D1 AFTER schema.sql + migrations 002–012.
--   wrangler d1 execute ubuntu-demo-db --remote --file db/schema.sql
--   (then each migration in order)
--   wrangler d1 execute ubuntu-demo-db --remote --file db/seed-demo.sql
-- Published demo logins:
--   Staff (admin):  demo@daycareos.ubuntutown.co.za  /  demo1234
--   Parent (OTP):   parent@daycareos.ubuntutown.co.za  (code 123456 — DEMO_MODE)
--   Public portal:  /parent/demo-portal-token
-- NOTE: outbound email/SMS is neutered on the demo worker (no RESEND/SMS keys),
--       and DEMO_MODE makes the parent OTP a fixed 123456, so nothing is emailed.

-- ── Branding / settings ─────────────────────────────────────────
INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES
  ('daycare_name', 'Ubuntu Demo Daycare'),
  ('daycare_address', '42 Freedom Street, Soweto, Gauteng'),
  ('npo_number', 'NPO-2026/DEMO'),
  ('website', 'https://daycareos.ubuntutown.co.za'),
  ('official_email', 'demo@daycareos.ubuntutown.co.za'),
  ('uif_enabled', 'true'),
  ('paye_enabled', 'false');

-- ── Staff (principal has a real password hash for demo login) ────
INSERT INTO staff (staff_id, full_name, job_title, email, phone, basic_salary, uif_enabled, paye_enabled, active, password_hash, start_date) VALUES
  ('d-staff-principal','Thandi Mokoena','Daycare Principal','demo@daycareos.ubuntutown.co.za','0721000001',12000,1,1,1,'t4YJdrflNsxTKKOComHJ1g:2-nZSo87gwcqaTGUiUBPy7s9ROmicHT0lGNice1X4JU:100000','2023-01-10'),
  ('d-staff-lerato','Lerato Dlamini','Caregiver','lerato@daycareos.ubuntutown.co.za','0721000002',6500,1,0,1,NULL,'2023-03-01'),
  ('d-staff-sipho','Sipho Ndlovu','Assistant','sipho@daycareos.ubuntutown.co.za','0721000003',5000,1,0,1,NULL,'2024-02-15'),
  ('d-staff-naledi','Naledi Khumalo','Caregiver','naledi@daycareos.ubuntutown.co.za','0721000004',6500,1,0,1,NULL,'2024-06-01');

-- ── Parents ─────────────────────────────────────────────────────
INSERT INTO parents (parent_id, full_name, phone, email, relationship_to_child) VALUES
  ('d-parent-demo','Demo Parent','0720000000','parent@daycareos.ubuntutown.co.za','Mother'),
  ('d-parent-01','Nomsa Zwane','0720000011','nomsa.z@example.co.za','Mother'),
  ('d-parent-02','Kagiso Molefe','0720000012','kagiso.m@example.co.za','Father'),
  ('d-parent-03','Ayanda Nkosi','0720000013','ayanda.n@example.co.za','Mother'),
  ('d-parent-04','Bongani Sithole','0720000014','bongani.s@example.co.za','Father'),
  ('d-parent-05','Palesa Moloi','0720000015','palesa.m@example.co.za','Mother'),
  ('d-parent-06','Themba Mahlangu','0720000016','themba.m@example.co.za','Father'),
  ('d-parent-07','Zanele Dube','0720000017','zanele.d@example.co.za','Mother'),
  ('d-parent-08','Tshepo Radebe','0720000018','tshepo.r@example.co.za','Father'),
  ('d-parent-09','Lindiwe Mbeki','0720000019','lindiwe.m@example.co.za','Grandmother');

-- ── Children (demo child has a public portal token) ─────────────
INSERT INTO children (child_id, full_name, date_of_birth, age_group, enrolment_date, status, parent_id, gender, race, income_category, allergies, medical_notes) VALUES
  ('d-child-demo','Amara Parker','2022-04-18','2-3 years','2024-02-01','active','d-parent-demo','female','african','single_parent','None','Cheerful, settles well after morning drop-off.'),
  ('d-child-01','Lwazi Zwane','2021-09-02','3-4 years','2023-02-01','active','d-parent-01','male','african','dual_parent',NULL,NULL),
  ('d-child-02','Boitumelo Molefe','2020-06-11','Grade R (5-6)','2023-01-15','active','d-parent-02','female','african','dual_parent','Peanuts',NULL),
  ('d-child-03','Sindi Nkosi','2022-01-20','2-3 years','2024-01-10','active','d-parent-03','female','african','single_parent',NULL,NULL),
  ('d-child-04','Junior Sithole','2023-03-05','Toddlers (1-2)','2024-08-01','active','d-parent-04','male','african','dual_parent',NULL,'Asthma pump kept with caregiver.'),
  ('d-child-05','Katlego Moloi','2021-11-30','3-4 years','2023-06-01','active','d-parent-05','male','african','single_parent',NULL,NULL),
  ('d-child-06','Nkosana Mahlangu','2020-08-25','Grade R (5-6)','2022-09-01','active','d-parent-06','male','african','dual_parent',NULL,NULL),
  ('d-child-07','Precious Dube','2022-07-14','2-3 years','2024-03-01','active','d-parent-07','female','african','dual_parent','Dairy',NULL),
  ('d-child-08','Rethabile Radebe','2023-01-09','Toddlers (1-2)','2024-05-01','active','d-parent-08','female','african','single_parent',NULL,NULL),
  ('d-child-09','Sege Mbeki','2024-02-02','Babies (0-1)','2024-09-01','active','d-parent-09','male','african','single_parent',NULL,NULL),
  ('d-child-10','Zinhle Zwane','2020-12-19','Grade R (5-6)','2022-08-01','active','d-parent-01','female','african','dual_parent',NULL,NULL),
  ('d-child-11','Owami Nkosi','2023-05-21','Toddlers (1-2)','2024-10-01','active','d-parent-03','male','african','single_parent',NULL,NULL),
  ('d-child-12','Karabo Molefe','2021-10-08','3-4 years','2023-04-01','active','d-parent-02','female','african','dual_parent',NULL,NULL);

UPDATE children SET portal_token='demo-portal-token', portal_token_expires_at='2027-12-31T00:00:00Z' WHERE child_id='d-child-demo';

-- ── Fee schedules ───────────────────────────────────────────────
INSERT INTO fee_schedules (schedule_id, age_group, monthly_fee, description, active) VALUES
  ('d-fee-babies','Babies (0-1)',950,'Full day incl. meals',1),
  ('d-fee-toddlers','Toddlers (1-2)',900,'Full day incl. meals',1),
  ('d-fee-2-3','2-3 years',850,'Full day incl. meals',1),
  ('d-fee-3-4','3-4 years',850,'Full day incl. meals',1),
  ('d-fee-gradeR','Grade R (5-6)',1000,'Full day incl. Grade R programme',1);

-- ── Fee records: July 2026 (mix of paid / partial / outstanding) ─
INSERT INTO fee_records (fee_id, child_id, schedule_id, month, year, amount_due, amount_paid, payment_method, payment_date, status) VALUES
  ('d-fee-07-demo','d-child-demo','d-fee-2-3',7,2026,850,0,NULL,NULL,'pending'),
  ('d-fee-07-01','d-child-01','d-fee-3-4',7,2026,850,850,'eft','2026-07-03','paid'),
  ('d-fee-07-02','d-child-02','d-fee-gradeR',7,2026,1000,1000,'eft','2026-07-02','paid'),
  ('d-fee-07-03','d-child-03','d-fee-2-3',7,2026,850,400,'cash','2026-07-05','partial'),
  ('d-fee-07-04','d-child-04','d-fee-toddlers',7,2026,900,0,NULL,NULL,'pending'),
  ('d-fee-07-05','d-child-05','d-fee-3-4',7,2026,850,850,'cash','2026-07-04','paid'),
  ('d-fee-07-06','d-child-06','d-fee-gradeR',7,2026,1000,0,NULL,NULL,'pending'),
  ('d-fee-07-07','d-child-07','d-fee-2-3',7,2026,850,850,'eft','2026-07-06','paid'),
  ('d-fee-07-08','d-child-08','d-fee-toddlers',7,2026,900,900,'nsnp_subsidy','2026-07-01','paid'),
  ('d-fee-07-09','d-child-09','d-fee-babies',7,2026,950,0,NULL,NULL,'pending'),
  ('d-fee-07-10','d-child-10','d-fee-gradeR',7,2026,1000,500,'cash','2026-07-07','partial'),
  ('d-fee-07-11','d-child-11','d-fee-toddlers',7,2026,900,900,'eft','2026-07-02','paid'),
  ('d-fee-07-12','d-child-12','d-fee-3-4',7,2026,850,850,'eft','2026-07-03','paid'),
  ('d-fee-06-demo','d-child-demo','d-fee-2-3',6,2026,850,850,'eft','2026-06-04','paid'),
  ('d-fee-06-04','d-child-04','d-fee-toddlers',6,2026,900,900,'cash','2026-06-05','paid'),
  ('d-fee-06-06','d-child-06','d-fee-gradeR',6,2026,1000,1000,'eft','2026-06-02','paid'),
  ('d-fee-06-09','d-child-09','d-fee-babies',6,2026,950,950,'cash','2026-06-06','paid');

-- ── Attendance (July 2026 weekdays) ─────────────────────────────
INSERT INTO attendance_records (id, child_id, date, check_in_time, check_out_time, status, recorded_by) VALUES
  ('d-att-0701-demo','d-child-demo','2026-07-01','07:45','16:50','present','d-staff-principal'),
  ('d-att-0702-demo','d-child-demo','2026-07-02','07:50','16:40','present','d-staff-principal'),
  ('d-att-0703-demo','d-child-demo','2026-07-03','08:10','16:45','late','d-staff-principal'),
  ('d-att-0706-demo','d-child-demo','2026-07-06','07:40','16:55','present','d-staff-principal'),
  ('d-att-0707-demo','d-child-demo','2026-07-07',NULL,NULL,'absent','d-staff-principal'),
  ('d-att-0708-demo','d-child-demo','2026-07-08','07:48','16:50','present','d-staff-principal'),
  ('d-att-0709-demo','d-child-demo','2026-07-09','07:52','16:35','present','d-staff-principal'),
  ('d-att-0710-demo','d-child-demo','2026-07-10','07:44','16:50','present','d-staff-principal'),
  ('d-att-0701-01','d-child-01','2026-07-01','07:30','16:30','present','d-staff-lerato'),
  ('d-att-0702-01','d-child-01','2026-07-02','07:35','16:32','present','d-staff-lerato'),
  ('d-att-0703-01','d-child-01','2026-07-03','07:33','16:30','present','d-staff-lerato'),
  ('d-att-0706-01','d-child-01','2026-07-06','07:40','16:30','present','d-staff-lerato'),
  ('d-att-0707-01','d-child-01','2026-07-07','07:38','16:31','present','d-staff-lerato'),
  ('d-att-0701-02','d-child-02','2026-07-01','07:20','16:20','present','d-staff-lerato'),
  ('d-att-0702-02','d-child-02','2026-07-02','07:25','16:22','present','d-staff-lerato'),
  ('d-att-0703-02','d-child-02','2026-07-03',NULL,NULL,'absent','d-staff-lerato'),
  ('d-att-0706-02','d-child-02','2026-07-06','07:29','16:20','present','d-staff-lerato'),
  ('d-att-0701-04','d-child-04','2026-07-01','08:00','16:10','present','d-staff-naledi'),
  ('d-att-0702-04','d-child-04','2026-07-02','08:05','16:12','late','d-staff-naledi'),
  ('d-att-0703-04','d-child-04','2026-07-03','07:58','16:10','present','d-staff-naledi'),
  ('d-att-0706-04','d-child-04','2026-07-06','08:02','16:15','present','d-staff-naledi'),
  ('d-att-0701-06','d-child-06','2026-07-01','07:15','16:40','present','d-staff-principal'),
  ('d-att-0702-06','d-child-06','2026-07-02','07:18','16:38','present','d-staff-principal'),
  ('d-att-0703-06','d-child-06','2026-07-03','07:16','16:40','present','d-staff-principal'),
  ('d-att-0707-06','d-child-06','2026-07-07','07:20','16:41','present','d-staff-principal'),
  ('d-att-0708-06','d-child-06','2026-07-08','07:19','16:39','present','d-staff-principal'),
  ('d-att-0701-09','d-child-09','2026-07-01','08:15','15:30','present','d-staff-naledi'),
  ('d-att-0702-09','d-child-09','2026-07-02','08:20','15:32','present','d-staff-naledi'),
  ('d-att-0703-09','d-child-09','2026-07-03','08:18','15:30','present','d-staff-naledi');

-- ── Notices ─────────────────────────────────────────────────────
INSERT INTO notices (notice_id, title, content, category, pinned, published, published_at, author_id) VALUES
  ('d-notice-1','Welcome to Ubuntu Demo Daycare! 🌟','This is a live demo of Ubuntu Daycare OS. Explore attendance, fees, daily logs, the parent app and more — all with sample data.','general',1,1,'2026-07-01T08:00:00Z','d-staff-principal'),
  ('d-notice-2','August fees due by the 7th','A friendly reminder that August fees are due by 7 August. EFT, cash and subsidy are all accepted. Thank you!','urgent',1,1,'2026-07-10T09:00:00Z','d-staff-principal'),
  ('d-notice-3','Mandela Day — 18 July 🎉','We will spend 67 minutes on a small garden project with the children. Please send an old t-shirt for painting day.','event',0,1,'2026-07-08T10:00:00Z','d-staff-principal'),
  ('d-notice-4','Parent meeting — 25 July','Termly parent meeting at 17:30 in the main hall. Reports and the new Grade R plan will be shared.','general',0,1,'2026-07-09T10:00:00Z','d-staff-principal'),
  ('d-notice-5','Winter closure notice','The centre will close 1–2 August for winter maintenance. Aftercare arrangements available on request.','closure',0,1,'2026-07-05T10:00:00Z','d-staff-principal');

-- ── Daily logs ──────────────────────────────────────────────────
INSERT INTO daily_logs (log_id, child_id, staff_id, log_date, activity_type, description, mood, notes) VALUES
  ('d-log-1','d-child-demo','d-staff-lerato','2026-07-10','meal','Ate all of her lunch (samp & beans) and asked for more fruit.','happy',NULL),
  ('d-log-2','d-child-demo','d-staff-lerato','2026-07-10','nap','Slept well from 12:30 to 14:00.','calm',NULL),
  ('d-log-3','d-child-demo','d-staff-lerato','2026-07-10','activity','Enjoyed finger painting and shared her colours with a friend.','happy','Great social day!'),
  ('d-log-4','d-child-01','d-staff-lerato','2026-07-10','activity','Built a tall block tower and counted to 12.','happy',NULL),
  ('d-log-5','d-child-04','d-staff-naledi','2026-07-10','meal','Small appetite today, drank all his milk.','tired',NULL),
  ('d-log-6','d-child-06','d-staff-principal','2026-07-10','activity','Led the morning song for Grade R.','happy',NULL),
  ('d-log-7','d-child-09','d-staff-naledi','2026-07-10','nappy','Two changes this morning, no rash.','calm',NULL),
  ('d-log-8','d-child-demo','d-staff-lerato','2026-07-09','mood','Bright and chatty all afternoon.','happy',NULL),
  ('d-log-9','d-child-02','d-staff-lerato','2026-07-09','activity','Practised writing her name — lovely progress.','happy',NULL);

-- ── Developmental milestones ────────────────────────────────────
INSERT INTO developmental_milestones (milestone_id, child_id, milestone_type, status, achieved_date, notes, assessed_by) VALUES
  ('d-ms-1','d-child-demo','24m','achieved','2026-06-20','Speaks in clear 3-4 word sentences.','d-staff-lerato'),
  ('d-ms-2','d-child-demo','18m','achieved','2026-05-15','Builds a tower of 6+ blocks.','d-staff-lerato'),
  ('d-ms-3','d-child-demo','36m','pending',NULL,'Working on counting to 10.','d-staff-lerato'),
  ('d-ms-4','d-child-06','48m','achieved','2026-06-01','Writes own name confidently.','d-staff-principal'),
  ('d-ms-5','d-child-06','36m','achieved','2026-04-18','Recognises most letters.','d-staff-principal'),
  ('d-ms-6','d-child-04','12m','achieved','2026-04-10','Walks steadily on his own.','d-staff-naledi'),
  ('d-ms-7','d-child-09','6m','achieved','2026-06-30','Sits without support.','d-staff-naledi'),
  ('d-ms-8','d-child-01','24m','achieved','2026-03-22','Toilet trained during the day.','d-staff-lerato');

-- ── Leave requests ──────────────────────────────────────────────
INSERT INTO leave_requests (leave_id, staff_id, leave_type, start_date, end_date, reason, status, approved_by) VALUES
  ('d-leave-1','d-staff-lerato','annual','2026-07-21','2026-07-25','Family visit','approved','d-staff-principal'),
  ('d-leave-2','d-staff-sipho','sick','2026-07-08','2026-07-09','Flu','pending',NULL);

-- ── Waitlist ────────────────────────────────────────────────────
INSERT INTO waitlist (waitlist_id, child_name, parent_name, parent_phone, parent_email, age_group, preferred_start_date, status, position) VALUES
  ('d-wait-1','Baby Nkululeko','Fikile Mthembu','0720000031','fikile.m@example.co.za','Babies (0-1)','2026-09-01','waiting',1),
  ('d-wait-2','Aphiwe Cele','Sibusiso Cele','0720000032','sibusiso.c@example.co.za','Toddlers (1-2)','2026-08-15','waiting',2),
  ('d-wait-3','Mihlali Jantjies','Ncedi Jantjies','0720000033','ncedi.j@example.co.za','2-3 years','2026-10-01','contacted',3);

-- ── Compliance: mark several complete for a healthy readiness view ─
UPDATE compliance_items SET status='complete' WHERE compliance_id IN ('comp-1','comp-2','comp-3','comp-4','comp-6','comp-7','comp-10');
UPDATE compliance_items SET status='needs_attention' WHERE compliance_id IN ('comp-5','comp-11');
-- (comp-8, comp-9 remain missing to show real gaps)

-- ── Messaging (demo parent thread) ──────────────────────────────
INSERT INTO message_threads (thread_id, child_id, parent_id, last_message_at) VALUES
  ('d-thread-demo','d-child-demo','d-parent-demo','2026-07-10T15:10:00Z');
INSERT INTO thread_messages (message_id, thread_id, sender_type, sender_id, sender_name, body, read_at, created_at) VALUES
  ('d-msg-1','d-thread-demo','staff','d-staff-lerato','Lerato Dlamini','Good morning! Amara had a wonderful day — she shared her paints with a friend. 🎨','2026-07-10T13:00:00Z','2026-07-10T12:40:00Z'),
  ('d-msg-2','d-thread-demo','parent','d-parent-demo','Demo Parent','That is so lovely to hear, thank you! Did she finish her lunch?','2026-07-10T14:05:00Z','2026-07-10T13:55:00Z'),
  ('d-msg-3','d-thread-demo','staff','d-staff-lerato','Lerato Dlamini','She did — samp & beans and then extra fruit. See you at pick-up! 😊',NULL,'2026-07-10T15:10:00Z');

-- ── Notifications (delivery log history; demo worker sends nothing) ─
INSERT INTO notifications (notification_id, parent_id, child_id, type, title, body, channel, status, sent_at, created_at) VALUES
  ('d-ntf-1','d-parent-demo','d-child-demo','photo','New photo of Amara Parker','Amara''s teachers added a new photo. Open your parent app to see it.','email','sent','2026-07-10T11:05:00Z','2026-07-10T11:04:00Z'),
  ('d-ntf-2','d-parent-demo','d-child-demo','message','New message about Amara Parker','Lerato Dlamini sent you a message.','email','sent','2026-07-10T12:41:00Z','2026-07-10T12:40:00Z'),
  ('d-ntf-3','d-parent-demo','d-child-demo','fee_reminder','Fee reminder for Amara Parker','Our records show an outstanding balance of R850 for Amara Parker.','email','sent','2026-07-10T09:00:00Z','2026-07-10T09:00:00Z'),
  ('d-ntf-4','d-parent-01','d-child-01','photo','New photo of Lwazi Zwane','Lwazi''s teachers added a new photo.','email','sent','2026-07-09T11:00:00Z','2026-07-09T11:00:00Z');

-- ── Ubuntu Town coordinator config (for the Town view) ──────────
DELETE FROM town_config;
INSERT INTO town_config (town_id, town_name, coordinator_name, coordinator_email, coordinator_phone, primary_color, tagline, centres, total_children, active) VALUES
  ('demo-town','Ubuntu Town (Demo)','Coordinator Naledi','coordinator@ubuntutown.co.za','0720000099','#4B1F78','Stronger Centres. Brighter Futures. Together.',8,214,1);
