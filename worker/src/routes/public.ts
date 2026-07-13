import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { signJwt, hashPassword, type JwtPayload } from '../auth';
import { sessionCookie, cookieDomain, isRateLimited, bumpRateLimit, verifyTurnstile } from '../lib';
import { centreForHost, DEFAULT_CENTRE_ID } from '../tenant';
import { seedCentreDefaults, slugify } from '../provisioning';

const r = new Hono<AppEnv>();

// ── Self-serve signup: create a centre + its owner (admin), seed defaults, auto-login ──
const Signup = z.object({
  centre_name: z.string().trim().min(2).max(120),
  owner_name: z.string().trim().min(2).max(120),
  owner_email: z.string().email(),
  password: z.string().min(8).max(200),
  province: z.string().trim().max(60).optional(),
  slug: z.string().trim().max(40).optional(),
  turnstileToken: z.string().optional(),
});

// POST /api/public/signup (public) — provision a new pooled tenant in seconds.
r.post('/public/signup', async (c) => {
  const parsed = Signup.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Provide a centre name, your name, a valid email and a password (min 8 characters).' }, 400);
  const d = parsed.data;

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rlKey = `signup:${ip}`;
  if (await isRateLimited(c.env, rlKey, 5)) return c.json({ ok: false, error: 'Too many signups from this network. Please wait a few minutes.' }, 429);
  await bumpRateLimit(c.env, rlKey, 3600);
  if (!(await verifyTurnstile(c.env, d.turnstileToken, ip))) return c.json({ ok: false, error: 'Verification failed. Please try again.' }, 400);

  // Guarantee a unique slug for the subdomain.
  const base = slugify(d.slug || d.centre_name);
  let slug = base;
  for (let n = 2; n <= 60; n++) {
    const taken = await c.env.DB.prepare('SELECT 1 AS x FROM centres WHERE slug = ?').bind(slug).first();
    if (!taken) break;
    slug = `${base}-${n}`;
    if (n === 60) slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
  }

  const centreId = `centre-${crypto.randomUUID()}`;
  const staffId = `staff-${crypto.randomUUID()}`;
  const pwHash = await hashPassword(d.password);
  const host = `${slug}.daycareos.ubuntutown.co.za`;

  await c.env.DB.prepare(
    `INSERT INTO centres (centre_id, slug, name, status, plan, mode, owner_staff_id, province, official_email)
     VALUES (?, ?, ?, 'trialing', 'self_service', 'pooled', ?, ?, ?)`,
  ).bind(centreId, slug, d.centre_name, staffId, d.province || null, d.owner_email).run();

  await c.env.DB.prepare(
    `INSERT INTO staff (staff_id, full_name, job_title, email, password_hash, active, centre_id, created_at, updated_at)
     VALUES (?, ?, 'Daycare Principal', ?, ?, 1, ?, datetime('now'), datetime('now'))`,
  ).bind(staffId, d.owner_name, d.owner_email, pwHash, centreId).run();

  await c.env.DB.prepare('INSERT OR IGNORE INTO centre_domains (host, centre_id) VALUES (?, ?)').bind(host, centreId).run();

  await seedCentreDefaults(c.env.DB, centreId, { name: d.centre_name, province: d.province, email: d.owner_email });

  const db = initDb(c.env.DB, centreId);
  await db.insertAudit({ id: db.uuid(), user_id: staffId, action: 'signed_up', module_name: 'centre', record_id: centreId, metadata: JSON.stringify({ slug }) });

  // Auto-login the owner so the setup wizard starts immediately.
  const maxAge = 12 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { sub: staffId, role: 'admin', email: d.owner_email, name: d.owner_name, centre_id: centreId, iat: now, exp: now + maxAge };
  const token = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', sessionCookie(token, maxAge, cookieDomain(c.env)));

  return c.json({ ok: true, data: { centre_id: centreId, slug, subdomain: host, login_url: `https://${host}`, token, user: { id: staffId, name: d.owner_name, email: d.owner_email, role: 'admin', centre_id: centreId } } });
});

// GET /api/health
r.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// GET /api/public/child/:token — unauthenticated parent portal (minimised PII)
r.get('/public/child/:token', async (c) => {
  const portalToken = c.req.param('token');
  const child = await c.env.DB.prepare(
    `SELECT c.child_id, c.full_name, c.age_group, c.status, c.centre_id, p.full_name as parent_name
     FROM children c LEFT JOIN parents p ON c.parent_id = p.parent_id AND p.centre_id = c.centre_id
     WHERE c.portal_token = ?
       AND (c.portal_token_expires_at IS NULL OR c.portal_token_expires_at > datetime('now'))`,
  ).bind(portalToken).first();
  if (!child) return c.json({ ok: false, error: 'Child not found' }, 404);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const childId = (child as any).child_id;
  const centre = (child as any).centre_id || DEFAULT_CENTRE_ID;

  const attendance = await c.env.DB.prepare(
    `SELECT * FROM attendance_records WHERE child_id = ? AND centre_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ? ORDER BY date DESC`,
  ).bind(childId, centre, String(month).padStart(2, '0'), String(year)).all();
  const fees = await c.env.DB.prepare('SELECT * FROM fee_records WHERE child_id = ? AND centre_id = ? ORDER BY year DESC, month DESC LIMIT 12').bind(childId, centre).all();
  const notices = await c.env.DB.prepare('SELECT * FROM notices WHERE published = 1 AND centre_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 10').bind(centre).all();
  const settings = await c.env.DB.prepare('SELECT * FROM settings WHERE centre_id = ? LIMIT 1').bind(centre).first();
  const media = await c.env.DB.prepare('SELECT media_id, caption, created_at FROM media WHERE child_id = ? AND centre_id = ? ORDER BY created_at DESC LIMIT 24').bind(childId, centre).all();

  const totalDue = fees.results.reduce((s: number, f: any) => s + (f.amount_due || 0), 0);
  const totalPaid = fees.results.reduce((s: number, f: any) => s + (f.amount_paid || 0), 0);

  return c.json({
    ok: true,
    data: {
      child,
      attendance: attendance.results,
      fees: fees.results,
      notices: notices.results,
      settings,
      media: media.results,
      balance: { total_due: totalDue, total_paid: totalPaid, outstanding: totalDue - totalPaid },
    },
  });
});

// GET /api/public/qr/:token
r.get('/public/qr/:token', (c) =>
  c.json({ ok: true, data: { url: `https://app.lehakwedaycare.co.za/parent/${c.req.param('token')}` } }),
);

// GET /api/public/media/:token/:id — token-gated image stream for the parent portal
r.get('/public/media/:token/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT m.r2_key, m.content_type FROM media m JOIN children c ON m.child_id = c.child_id AND m.centre_id = c.centre_id
     WHERE m.media_id = ? AND c.portal_token = ?
       AND (c.portal_token_expires_at IS NULL OR c.portal_token_expires_at > datetime('now'))`,
  ).bind(c.req.param('id'), c.req.param('token')).first<any>();
  if (!row) return c.json({ ok: false, error: 'Not found' }, 404);
  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ ok: false, error: 'Not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': row.content_type || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
});

const Enquiry = z.object({
  child_name: z.string().min(1),
  parent_name: z.string().min(1),
  parent_phone: z.string().min(1),
  parent_email: z.string().optional(),
  age_group: z.string().optional(),
  dob: z.string().optional(),
  notes: z.string().optional(),
  consent: z.literal(true),
});

// POST /api/public/enquiry — website "Register your child" intake (consent-gated).
// Centre is resolved from the request Origin (subdomain → centre); defaults to centre #1.
r.post('/public/enquiry', async (c) => {
  const parsed = Enquiry.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const needsConsent = parsed.error.issues.some((i) => i.path.includes('consent'));
    return c.json(
      { ok: false, error: needsConsent ? 'Please tick the consent box so we may contact you.' : 'Please provide the child name, your name and a phone number.' },
      400,
    );
  }
  const b = parsed.data;
  let centre = DEFAULT_CENTRE_ID;
  const origin = c.req.header('Origin') || '';
  if (origin) { try { centre = (await centreForHost(c.env, new URL(origin).host)) || DEFAULT_CENTRE_ID; } catch { /* ignore */ } }
  const db = initDb(c.env.DB, centre);
  const id = crypto.randomUUID();
  const maxPos = await c.env.DB.prepare('SELECT MAX(position) AS max_pos FROM waitlist WHERE centre_id = ?').bind(centre).first<{ max_pos: number }>();
  const position = (maxPos?.max_pos || 0) + 1;
  await c.env.DB.prepare(
    `INSERT INTO waitlist (waitlist_id, child_name, parent_name, parent_phone, parent_email, age_group, preferred_start_date, status, notes, position, centre_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?)`,
  ).bind(
    id,
    b.child_name.slice(0, 120),
    b.parent_name.slice(0, 120),
    b.parent_phone.slice(0, 40),
    b.parent_email ? b.parent_email.slice(0, 120) : null,
    b.age_group ? b.age_group.slice(0, 40) : null,
    b.dob ? b.dob.slice(0, 20) : null,
    `Website enquiry. Consent given at ${new Date().toISOString()}.` + (b.notes ? ` Notes: ${b.notes.slice(0, 500)}` : ''),
    position,
    centre,
  ).run();
  await db.insertAudit({ id: db.uuid(), user_id: 'public', action: 'created', module_name: 'waitlist', record_id: id, metadata: JSON.stringify({ source: 'website' }) });
  return c.json({ ok: true, data: { received: true } });
});

export default r;
