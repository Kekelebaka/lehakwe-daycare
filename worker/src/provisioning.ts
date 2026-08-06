// Phase 4 PR C — per-centre provisioning.
// Seeds a brand-new centre with sensible defaults so the app is usable immediately:
// the canonical ECD compliance checklist, starter fee schedules (fees set in the wizard),
// and baseline settings. All rows are stamped with the new centre_id.
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { hashPassword } from './auth';

// Canonical ECD compliance checklist (mirrors the Lehakwe seed in schema.sql).
const DEFAULT_COMPLIANCE: Array<[string, string, string]> = [
  ['Centre', 'Centre Registration Certificate', 'needs_attention'],
  ['Centre', 'NPO Registration Documents', 'needs_attention'],
  ['Centre', 'Health Clearance Certificate', 'needs_attention'],
  ['Centre', 'Fire/Safety Compliance', 'needs_attention'],
  ['Staff', 'Staff ID Copies (All)', 'missing'],
  ['Staff', 'Staff Contracts (All)', 'missing'],
  ['Children', 'Child Registration Forms', 'missing'],
  ['Children', 'Parent Consent Forms', 'missing'],
  ['Children', 'Emergency Contacts Verified', 'missing'],
  ['Admin', 'Attendance Records Up to Date', 'needs_attention'],
  ['Admin', 'Payslip Records Up to Date', 'needs_attention'],
];

// Starter fee schedules (age bands) — the centre sets the actual monthly fee in the wizard.
const DEFAULT_FEE_SCHEDULES: Array<[string, number, string]> = [
  ['Babies (0–18m)', 0, 'Set your monthly fee in Fees & Finance'],
  ['Toddlers (18m–3y)', 0, 'Set your monthly fee in Fees & Finance'],
  ['Preschool (3–6y)', 0, 'Set your monthly fee in Fees & Finance'],
];

const uuid = () => crypto.randomUUID();

export async function seedCentreDefaults(
  db: D1Database,
  centreId: string,
  opts: { name: string; province?: string; email?: string },
): Promise<void> {
  const stmts: D1PreparedStatement[] = [];

  for (const [category, item, status] of DEFAULT_COMPLIANCE) {
    stmts.push(
      db.prepare('INSERT INTO compliance_items (compliance_id, category, item_name, status, centre_id) VALUES (?, ?, ?, ?, ?)')
        .bind(uuid(), category, item, status, centreId),
    );
  }

  for (const [ageGroup, fee, desc] of DEFAULT_FEE_SCHEDULES) {
    stmts.push(
      db.prepare('INSERT INTO fee_schedules (schedule_id, age_group, monthly_fee, description, centre_id) VALUES (?, ?, ?, ?, ?)')
        .bind(uuid(), ageGroup, fee, desc, centreId),
    );
  }

  const settings: Array<[string, string]> = [
    ['daycare_name', opts.name],
    ['province', opts.province || ''],
    ['official_email', opts.email || ''],
    ['npo_number', ''],
    ['uif_enabled', 'true'],
    ['paye_enabled', 'false'],
    ['setup_complete', 'false'],
  ];
  for (const [k, v] of settings) {
    stmts.push(
      db.prepare('INSERT INTO settings (centre_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(centre_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value')
        .bind(centreId, k, v),
    );
  }

  await db.batch(stmts);
}

// URL-safe slug from a centre name (lowercase, hyphenated, trimmed).
export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'centre';
}

// ── Phase 5: one shared provisioning path ─────────────────────────
// Used by BOTH the free/trial signup and the paid (Paystack) flow so a paying
// customer and a trial customer get an identical, fully-seeded centre.

/** Reserve a slug that is not already taken by another centre. */
export async function uniqueSlug(db: D1Database, desired: string): Promise<string> {
  const base = slugify(desired);
  let slug = base;
  for (let n = 2; n <= 60; n++) {
    const taken = await db.prepare('SELECT 1 AS x FROM centres WHERE slug = ?').bind(slug).first();
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export interface ProvisionInput {
  centreName: string;
  ownerName: string;
  ownerEmail: string;
  /** Omit for the paid/magic-link flow — a random secret is set and the owner
   *  signs in via the emailed one-time link, then chooses a password. */
  password?: string;
  province?: string;
  slug?: string;
  planCode: string;
  /** Tenant apex, e.g. "daycareos.ubuntutown.co.za". */
  baseDomain: string;
  status?: 'trialing' | 'active';
  paidUntil?: string | null;
  trialEndsAt?: string | null;
  coordinatorId?: string | null;
}

export interface ProvisionResult {
  centreId: string;
  staffId: string;
  slug: string;
  host: string;
  loginUrl: string;
}

/**
 * Create a fully-usable tenant: centre row, owner admin, subdomain mapping,
 * seeded defaults and a subscription. Idempotency is the caller's job (the
 * webhook guards on signup_intents.status).
 */
export async function provisionCentre(db: D1Database, input: ProvisionInput): Promise<ProvisionResult> {
  const slug = await uniqueSlug(db, input.slug || input.centreName);
  const centreId = `centre-${crypto.randomUUID()}`;
  const staffId = `staff-${crypto.randomUUID()}`;
  const host = `${slug}.${input.baseDomain}`;
  const centreStatus = input.status === 'active' ? 'active' : 'trialing';

  // No password supplied (paid flow) → set an unguessable one; the owner lands
  // via the one-time setup link and sets their own in the wizard.
  const pwHash = await hashPassword(input.password || crypto.randomUUID() + crypto.randomUUID());

  await db
    .prepare(
      `INSERT INTO centres (centre_id, slug, name, status, plan, mode, owner_staff_id, province, official_email)
       VALUES (?, ?, ?, ?, ?, 'pooled', ?, ?, ?)`,
    )
    .bind(centreId, slug, input.centreName, centreStatus, input.planCode, staffId, input.province || null, input.ownerEmail)
    .run();

  await db
    .prepare(
      `INSERT INTO staff (staff_id, full_name, job_title, email, password_hash, active, centre_id, created_at, updated_at)
       VALUES (?, ?, 'Daycare Principal', ?, ?, 1, ?, datetime('now'), datetime('now'))`,
    )
    .bind(staffId, input.ownerName, input.ownerEmail, pwHash, centreId)
    .run();

  await db.prepare('INSERT OR IGNORE INTO centre_domains (host, centre_id) VALUES (?, ?)').bind(host, centreId).run();

  await seedCentreDefaults(db, centreId, { name: input.centreName, province: input.province, email: input.ownerEmail });

  await db
    .prepare(
      `INSERT INTO subscriptions (subscription_id, centre_id, plan_code, status, trial_ends_at, paid_until)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(centre_id) DO UPDATE SET
         plan_code = excluded.plan_code,
         status = excluded.status,
         paid_until = excluded.paid_until,
         updated_at = datetime('now')`,
    )
    .bind(
      `sub-${crypto.randomUUID()}`,
      centreId,
      input.planCode,
      input.paidUntil ? 'active' : 'trialing',
      input.trialEndsAt || null,
      input.paidUntil || null,
    )
    .run();

  if (input.coordinatorId) {
    await db
      .prepare('INSERT OR IGNORE INTO coordinator_centres (coordinator_id, centre_id, relationship) VALUES (?, ?, ?)')
      .bind(input.coordinatorId, centreId, 'onboarded')
      .run();
  }

  return { centreId, staffId, slug, host, loginUrl: `https://${host}` };
}
