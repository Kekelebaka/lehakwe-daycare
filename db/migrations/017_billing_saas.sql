-- 017_billing_saas.sql — Phase 5: paid self-serve SaaS.
-- Additive + forward-only. Safe to re-run (IF NOT EXISTS / INSERT OR IGNORE).
--
-- Adds: plan catalogue, subscriptions (annual pay-once + renewal reminder),
-- payments (Paystack), signup intents (pay-first provisioning), one-time setup
-- tokens (the "magic link" a buyer receives), coordinators (Supabase SSO) and
-- their centre portfolios, plus webhook idempotency.
--
-- Money is stored in CENTS (ZAR). R599.00 -> 59900.

-- ── Plan catalogue ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  plan_code      TEXT PRIMARY KEY,          -- 'self_service' | 'community' | 'funding_pro'
  name           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'ZAR',
  period         TEXT NOT NULL DEFAULT 'year' CHECK (period IN ('year','month')),
  sponsored      INTEGER NOT NULL DEFAULT 0, -- 1 = sold via coordinators (Community)
  active         INTEGER NOT NULL DEFAULT 1,
  description    TEXT
);

INSERT OR IGNORE INTO plans (plan_code, name, price_cents, currency, period, sponsored, description) VALUES
  ('self_service', 'Self-Service',        59900, 'ZAR', 'year',  0, 'Everything a standalone centre needs to run professionally.'),
  ('community',    'Community',           25000, 'ZAR', 'year',  1, 'Sponsored access via Ubuntu Town coordinators & partner programmes.'),
  ('funding_pro',  'Ubuntu Funding Pro',   9900, 'ZAR', 'month', 0, 'The funding engine, unlimited.');

-- ── Subscriptions: one active row per centre ──────────────────────
-- Annual pay-once model: paid_until drives access. No card on file.
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  centre_id       TEXT NOT NULL,
  plan_code       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'trialing'
                    CHECK (status IN ('trialing','active','past_due','suspended','cancelled')),
  trial_ends_at   TEXT,                     -- ISO8601; NULL once paid
  paid_until      TEXT,                     -- ISO8601; access granted while > now
  grace_days      INTEGER NOT NULL DEFAULT 14,
  last_payment_id TEXT,
  reminder_sent_at TEXT,                    -- last renewal reminder (dedupe)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (centre_id) REFERENCES centres(centre_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_centre ON subscriptions(centre_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paid_until ON subscriptions(paid_until);

-- ── Payments (Paystack) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  payment_id     TEXT PRIMARY KEY,
  centre_id      TEXT,                      -- NULL until a pay-first signup provisions
  intent_id      TEXT,                      -- links to signup_intents for pay-first
  provider       TEXT NOT NULL DEFAULT 'paystack',
  provider_ref   TEXT NOT NULL,             -- Paystack transaction reference
  plan_code      TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'ZAR',
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','success','failed','abandoned','refunded')),
  payer_email    TEXT,
  paid_at        TEXT,
  channel        TEXT,                      -- card / bank / eft (from Paystack)
  raw            TEXT,                      -- provider payload snapshot (JSON)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_ref);
CREATE INDEX IF NOT EXISTS idx_payments_centre ON payments(centre_id);

-- ── Signup intents: pay BEFORE we provision the tenant ────────────
-- Buyer fills the form -> intent (pending) -> Paystack -> webhook success ->
-- provision centre + email the setup magic link.
CREATE TABLE IF NOT EXISTS signup_intents (
  intent_id     TEXT PRIMARY KEY,
  centre_name   TEXT NOT NULL,
  owner_name    TEXT NOT NULL,
  owner_email   TEXT NOT NULL,
  phone         TEXT,
  province      TEXT,
  plan_code     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','provisioned','failed','expired')),
  provider_ref  TEXT,                       -- Paystack reference
  centre_id     TEXT,                       -- set once provisioned
  slug          TEXT,
  coordinator_id TEXT,                      -- set when a coordinator buys on behalf
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  provisioned_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_signup_intents_ref ON signup_intents(provider_ref);
CREATE INDEX IF NOT EXISTS idx_signup_intents_email ON signup_intents(owner_email);

-- ── One-time setup tokens (the emailed "get started" magic link) ──
CREATE TABLE IF NOT EXISTS setup_tokens (
  token       TEXT PRIMARY KEY,
  centre_id   TEXT NOT NULL,
  staff_id    TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'setup' CHECK (purpose IN ('setup','recovery')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_setup_tokens_centre ON setup_tokens(centre_id);

-- ── Coordinators (Ubuntu Town, authenticated via Supabase SSO) ────
CREATE TABLE IF NOT EXISTS coordinators (
  coordinator_id   TEXT PRIMARY KEY,
  supabase_user_id TEXT UNIQUE,             -- Supabase auth.users.id (sub claim)
  email            TEXT NOT NULL,
  full_name        TEXT,
  phone            TEXT,
  town_id          TEXT,
  role             TEXT NOT NULL DEFAULT 'coordinator'
                     CHECK (role IN ('coordinator','network_admin')),
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coordinators_email ON coordinators(email);

-- Portfolio: which centres a coordinator may act for.
CREATE TABLE IF NOT EXISTS coordinator_centres (
  coordinator_id TEXT NOT NULL,
  centre_id      TEXT NOT NULL,
  relationship   TEXT NOT NULL DEFAULT 'manages'
                   CHECK (relationship IN ('manages','onboarded','observes')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (coordinator_id, centre_id)
);
CREATE INDEX IF NOT EXISTS idx_coord_centres_centre ON coordinator_centres(centre_id);

-- ── Webhook idempotency (never double-apply a Paystack event) ─────
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     TEXT PRIMARY KEY,            -- provider event id or hash of payload
  provider     TEXT NOT NULL DEFAULT 'paystack',
  event_type   TEXT,
  provider_ref TEXT,
  received_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Backfill: give every existing centre a subscription row ───────
-- Existing live centres (Lehakwe) are grandfathered to active for a year so
-- this migration can never lock a real daycare out of its own data.
INSERT OR IGNORE INTO subscriptions (subscription_id, centre_id, plan_code, status, paid_until)
SELECT 'sub-' || centre_id, centre_id, COALESCE(plan, 'self_service'), 'active',
       datetime('now', '+365 days')
FROM centres;
