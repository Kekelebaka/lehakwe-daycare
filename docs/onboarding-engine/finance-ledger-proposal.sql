-- finance-ledger-proposal.sql — DaycareOS lightweight centre ledger (PROPOSAL ONLY — NOT APPLIED)
-- Review required. Additive and forward-only; touches no existing table (fee_records/payslips untouched).
-- Design notes: amounts are INTEGER cents (never floats); printed source values and calculated
-- values are separate columns; every row carries provenance; every table is centre-scoped.
-- Derived from the Sally's Day Care migration (see finance-gap-analysis.md).

-- ── Reporting periods (month or quarter, as printed on the source) ─────────────
CREATE TABLE IF NOT EXISTS ledger_periods (
  period_id     TEXT PRIMARY KEY,                 -- e.g. 'per-<centre>-2026-09' / '...-2026-Q3JULSEP'
  centre_id     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('month','quarter')),
  label         TEXT NOT NULL,                    -- as printed: 'Sep-26', 'Jul-Sept'
  start_date    TEXT,                             -- ISO; NULL when the source is ambiguous
  end_date      TEXT,
  year_printed  INTEGER,                          -- NULL when the source does not print a year
  year_status   TEXT NOT NULL DEFAULT 'unprinted'
                  CHECK (year_printed IS NULL OR year_status IN ('printed','inferred','confirmed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_periods_centre_label ON ledger_periods(centre_id, label);

-- ── Ledger entries (income & expenditure, summary level) ──────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id          TEXT PRIMARY KEY,
  centre_id         TEXT NOT NULL,
  period_id         TEXT NOT NULL,
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('income','expense')),
  category          TEXT NOT NULL,                -- controlled by template category set; free text preserved in raw_value
  funding_source    TEXT NOT NULL DEFAULT 'unspecified'
                      CHECK (funding_source IN ('gde','other','unspecified')),  -- GDE/education vs other sources
  amount_cents      INTEGER NOT NULL,             -- as printed (raw source value, in cents)
  amount_kind       TEXT NOT NULL DEFAULT 'printed_component'
                      CHECK (amount_kind IN ('printed_component','printed_total','calculated','dash','blank')),
  invoice_total_cents INTEGER,                    -- per-invoice column where printed
  is_bank_charge    INTEGER NOT NULL DEFAULT 0,
  source_doc        TEXT NOT NULL,                -- 'D5' / 'D6' / ...
  source_row        TEXT,                         -- row label/number on the source
  raw_value         TEXT,                         -- verbatim source string (e.g. 'DASH', '3 961,20')
  notes             TEXT,
  verification_state TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_state IN ('unverified','verified','exception','accepted_as_reported')),
  import_batch      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_by        TEXT,
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id),
  FOREIGN KEY (period_id) REFERENCES ledger_periods(period_id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_centre_period ON ledger_entries(centre_id, period_id);
CREATE INDEX IF NOT EXISTS idx_ledger_centre_type   ON ledger_entries(centre_id, entry_type);

-- ── Budget allocations (as per SLA / costing framework) ───────────────────────
CREATE TABLE IF NOT EXISTS budget_allocations (
  allocation_id   TEXT PRIMARY KEY,
  centre_id       TEXT NOT NULL,
  period_id       TEXT NOT NULL,
  category        TEXT NOT NULL,
  alloc_pct       INTEGER NOT NULL,               -- percentage in whole numbers (50 = 50%)
  allocated_cents INTEGER NOT NULL,               -- as printed
  basis           TEXT NOT NULL DEFAULT 'funding_received',  -- document the multiplication basis
  basis_cents     INTEGER,                        -- the amount the % was applied to (e.g. 4,435,200)
  source_doc      TEXT NOT NULL,
  source_row      TEXT,
  verification_state TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_state IN ('unverified','verified','exception')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id),
  FOREIGN KEY (period_id) REFERENCES ledger_periods(period_id)
);

-- ── Bank balances (never assumed equal to surplus) ────────────────────────────
CREATE TABLE IF NOT EXISTS bank_balances (
  balance_id      TEXT PRIMARY KEY,
  centre_id       TEXT NOT NULL,
  period_id       TEXT NOT NULL,
  opening_cents   INTEGER,                        -- NULL = not supplied (NOT zero)
  closing_cents   INTEGER,
  movement_cents  INTEGER,                        -- calculated where both ends exist
  source_doc      TEXT NOT NULL,
  raw_opening     TEXT,
  raw_closing     TEXT,
  verification_state TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (verification_state IN ('unverified','verified','exception')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id),
  FOREIGN KEY (period_id) REFERENCES ledger_periods(period_id)
);

-- ── Report exceptions (printed vs calculated discrepancies etc.) ──────────────
CREATE TABLE IF NOT EXISTS report_exceptions (
  exception_id    TEXT PRIMARY KEY,
  centre_id       TEXT NOT NULL,
  report_type     TEXT NOT NULL,                  -- 'monthly_ie' | 'quarterly' | 'beneficiaries' | ...
  period_id       TEXT,
  code            TEXT NOT NULL,                  -- e.g. 'INVOICE_CELL_MISMATCH', 'SHORTFALL'
  description     TEXT NOT NULL,
  printed_value   TEXT,
  calculated_value TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved','accepted','superseded')),
  resolution_note TEXT,
  resolved_by     TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id),
  FOREIGN KEY (period_id) REFERENCES ledger_periods(period_id)
);
CREATE INDEX IF NOT EXISTS idx_report_exc_centre ON report_exceptions(centre_id, status);

-- ── Optional integrity views (documentation of invariants) ────────────────────
-- Period totals must come from printed_total rows or be summed explicitly by the
-- report layer; never mix 'printed_total' rows into component sums.
CREATE VIEW IF NOT EXISTS v_ledger_components AS
SELECT * FROM ledger_entries WHERE amount_kind = 'printed_component';
CREATE VIEW IF NOT EXISTS v_ledger_exceptions AS
SELECT * FROM ledger_entries WHERE verification_state = 'exception';
