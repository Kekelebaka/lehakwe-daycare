-- Phase 3: AI Assistant + Ubuntu Town Integration
-- Run: wrangler d1 execute lehakwe-db --remote --file=./db/migrations/003_phase3.sql

-- AI Templates
CREATE TABLE IF NOT EXISTS ai_templates (
  template_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'letter', 'notice', 'dsd', 'whatsapp', 'report'
  language TEXT DEFAULT 'en',
  prompt_template TEXT NOT NULL,
  output_type TEXT DEFAULT 'text', -- 'text', 'letter', 'whatsapp'
  variables TEXT, -- JSON array of variable names
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Generated Documents
CREATE TABLE IF NOT EXISTS generated_docs (
  doc_id TEXT PRIMARY KEY,
  template_id TEXT,
  input_variables TEXT, -- JSON object
  output_text TEXT NOT NULL,
  doc_type TEXT NOT NULL, -- 'letter', 'notice', 'dsd', 'whatsapp', 'report', 'custom'
  language TEXT DEFAULT 'en',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES ai_templates(template_id)
);

-- Town Config (Ubuntu Town white-label)
CREATE TABLE IF NOT EXISTS town_config (
  town_id TEXT PRIMARY KEY,
  town_name TEXT NOT NULL,
  coordinator_name TEXT,
  coordinator_email TEXT,
  coordinator_phone TEXT,
  primary_color TEXT DEFAULT '#0B5FB3',
  logo_url TEXT,
  tagline TEXT DEFAULT 'Part of the Ubuntu Town Network',
  centres INTEGER DEFAULT 0,
  total_children INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Centre-Town link
ALTER TABLE settings ADD COLUMN town_id TEXT REFERENCES town_config(town_id);

-- Seed AI Templates
INSERT INTO ai_templates (template_id, name, category, language, prompt_template, output_type, variables) VALUES
('tpl-permission-slip', 'Permission Slip', 'letter', 'en',
 'Write a professional permission slip for {child_name} to participate in {activity} at Lehakwe Daycare on {date}. Include: parent name {parent_name}, emergency contact, and a signature line. Tone: warm but formal. Include the daycare name, NPO number 22910695, and address 12625 Phase 6 Bloemside 9323.',
 'letter', '["child_name","parent_name","activity","date"]'),

('tpl-fee-notice', 'Fee Reminder Notice', 'letter', 'en',
 'Write a polite fee reminder letter to {parent_name} for {child_name}. Amount due: R{amount} for {month}. Days overdue: {days_overdue}. Include payment methods: cash, EFT, or NSNP subsidy. Tone: friendly but clear. Include late payment policy. Lehakwe Daycare, NPO 22910695.',
 'letter', '["parent_name","child_name","amount","month","days_overdue"]'),

('tpl-dsd-letter', 'DSD Subsidy Application', 'letter', 'en',
 'Write a formal application letter to the Department of Social Development (DSD) for {subsidy_type} funding for Lehakwe Daycare (NPO 22910695). Include: number of children ({num_children}), age groups served, address (12625 Phase 6 Bloemside 9323), contact (061 549 1701). Tone: professional, persuasive. Mention community impact.',
 'letter', '["subsidy_type","num_children"]'),

('tpl-welcome', 'New Parent Welcome', 'letter', 'en',
 'Write a welcome letter to {parent_name} for enrolling {child_name} at Lehakwe Daycare. Include: start date, what to bring (birth cert, immunization card, parent ID), operating hours (06:30-17:30), meals provided, emergency contact info. Tone: warm and welcoming. NPO 22910695.',
 'letter', '["parent_name","child_name","start_date"]'),

('tpl-absence', 'Absence Notification', 'whatsapp', 'en',
 'Write a short WhatsApp message to {parent_name} about {child_name} being absent today ({date}). Ask if everything is okay and when they plan to return. Tone: caring and concerned, not accusatory. Keep it under 50 words.',
 'whatsapp', '["parent_name","child_name","date"]'),

('tpl-monthly-report', 'Monthly Report Narrative', 'report', 'en',
 'Write a monthly narrative report for {month} at Lehakwe Daycare. Include: enrolment ({num_children} children), activities done ({activities}), meals provided, any incidents, and upcoming plans. Tone: professional for DSD reporting. NPO 22910695, Bloemside.',
 'text', '["month","num_children","activities"]'),

('tpl-closure-notice', 'Holiday Closure Notice', 'notice', 'en',
 'Write a notice to parents about {closure_reason} closure on {date}. Include when centre reopens. Tone: clear and friendly. Lehakwe Daycare.',
 'text', '["closure_reason","date"]'),

('tpl-seeda', 'SEDA Funding Application', 'letter', 'en',
 'Write a one-page funding application to SEDA for Lehakwe Daycare (NPO 22910695). Include: mission (quality ECD for Bloemside community), number of children served ({num_children}), staff ({num_staff}), current needs ({needs}). Tone: professional, community-focused.',
 'letter', '["num_children","num_staff","needs"]');

-- Seed Town Config (Ubuntu Town)
INSERT INTO town_config (town_id, town_name, coordinator_name, tagline, centres) VALUES
('bloemfontein', 'Bloemfontein', 'Keke Lebaka', 'Ubuntu Town — Free State Capital', 1);
