-- 013_funding.sql — Ubuntu Funding Navigator (the moat). Additive + forward-only.
-- funding_opportunities = shared reference catalog (seeded here for every instance).
-- funding_applications  = per-centre pipeline / funding CRM.

CREATE TABLE IF NOT EXISTS funding_opportunities (
  opportunity_id        TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  funder                TEXT NOT NULL,
  category              TEXT NOT NULL,            -- government | lottery | csi | ngo | foundation
  description           TEXT,
  min_amount            REAL,
  max_amount            REAL,
  currency              TEXT DEFAULT 'ZAR',
  deadline              TEXT,                     -- ISO date or 'Rolling'
  url                   TEXT,
  requires_npo          INTEGER NOT NULL DEFAULT 0,
  requires_registration INTEGER NOT NULL DEFAULT 0,
  provinces             TEXT DEFAULT 'all',       -- 'all' or CSV of provinces
  focus                 TEXT,                     -- subsidy | infrastructure | nutrition | training | quality
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS funding_applications (
  application_id   TEXT PRIMARY KEY,
  opportunity_id   TEXT,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','rejected','received')),
  amount_requested REAL,
  amount_awarded   REAL,
  submitted_at     TEXT,
  decision_at      TEXT,
  notes            TEXT,
  content          TEXT,                          -- AI-generated application pack (markdown)
  created_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (opportunity_id) REFERENCES funding_opportunities(opportunity_id)
);
CREATE INDEX IF NOT EXISTS idx_funding_apps_status ON funding_applications(status);
CREATE INDEX IF NOT EXISTS idx_funding_apps_opp ON funding_applications(opportunity_id);

-- Starter catalog of South African ECD funding opportunities (reference data).
INSERT OR IGNORE INTO funding_opportunities
  (opportunity_id, name, funder, category, description, min_amount, max_amount, deadline, url, requires_npo, requires_registration, provinces, focus) VALUES
 ('opp-dsd-subsidy','ECD Subsidy (per-child)','Department of Social Development','government','Per-child daily subsidy (R24/child/day) for registered ECD centres serving low-income families. The backbone of ECD funding in South Africa.',0,600000,'Rolling','https://www.dsd.gov.za',0,1,'all','subsidy'),
 ('opp-lottery-infra','Charities Funding: ECD Infrastructure','National Lotteries Commission','lottery','Grants for ECD infrastructure, safe play equipment and educational resources.',50000,1500000,'2026-09-30','https://www.nlcsa.org.za',1,1,'all','infrastructure'),
 ('opp-elma','Early Learning Grant','ELMA Foundation','foundation','Supports organisations improving early learning quality and outcomes at scale.',100000,2000000,'Rolling','https://www.elmaphilanthropies.org',1,0,'all','quality'),
 ('opp-dgmt','Innovation in Early Childhood','DG Murray Trust','foundation','Funds innovative, scalable early childhood interventions across South Africa.',50000,1000000,'Rolling','https://dgmt.co.za',1,0,'all','quality'),
 ('opp-smartstart','SmartStart Early Learning Support','SmartStart','ngo','Training, materials and seed support for early learning playgroups and franchises.',0,25000,'Rolling','https://smartstart.org.za',0,0,'all','training'),
 ('opp-nsnp-nutrition','ECD Nutrition Support (NSNP-ECD)','Department of Basic Education','government','Nutrition support for registered ECD programmes under the national school nutrition pilot.',0,300000,'2026-10-31','https://www.education.gov.za',0,1,'all','nutrition'),
 ('opp-csi-corporate','Corporate CSI — Early Learning','Corporate CSI (various)','csi','Corporate social investment grants earmarked for early childhood development and community upliftment.',20000,500000,'Rolling',NULL,1,0,'all','quality');
