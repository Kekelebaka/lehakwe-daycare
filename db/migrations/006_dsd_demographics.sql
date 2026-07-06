-- Migration 006: DSD demographic fields for compliance reporting
-- Adds gender, race, disability, income_category to children
-- Adds gender, race, disability, training, subsidised to staff
-- Adds province, municipality, emis_number, manager_name to settings

-- ── CHILDREN: add demographic columns ──
ALTER TABLE children ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE children ADD COLUMN race TEXT CHECK (race IN ('african', 'coloured', 'asian', 'white', 'other'));
ALTER TABLE children ADD COLUMN disability TEXT CHECK (disability IN ('yes', 'no'));
ALTER TABLE children ADD COLUMN disability_description TEXT;
ALTER TABLE children ADD COLUMN income_category TEXT CHECK (income_category IN ('single_parent', 'dual_parent', 'other'));
ALTER TABLE children ADD COLUMN id_number TEXT;
ALTER TABLE children ADD COLUMN days_attended_current_month INTEGER DEFAULT 0;

-- ── STAFF: add demographic columns ──
ALTER TABLE staff ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE staff ADD COLUMN race TEXT CHECK (race IN ('african', 'coloured', 'asian', 'white', 'other'));
ALTER TABLE staff ADD COLUMN disability TEXT CHECK (disability IN ('yes', 'no'));
ALTER TABLE staff ADD COLUMN disability_description TEXT;
ALTER TABLE staff ADD COLUMN training_received TEXT;
ALTER TABLE staff ADD COLUMN training_type TEXT;
ALTER TABLE staff ADD COLUMN subsidised INTEGER NOT NULL DEFAULT 1;

-- ── SETTINGS: add DSD reporting fields ──
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('province', 'Free State');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('municipality', 'Mangaung');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('emis_number', '');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('manager_name', '');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('ward', '');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('fax_number', '');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('town', 'Bloemfontein');
