// Phase 4 PR C — per-centre provisioning.
// Seeds a brand-new centre with sensible defaults so the app is usable immediately:
// the canonical ECD compliance checklist, starter fee schedules (fees set in the wizard),
// and baseline settings. All rows are stamped with the new centre_id.
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

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
