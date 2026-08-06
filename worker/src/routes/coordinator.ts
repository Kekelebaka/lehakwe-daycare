// worker/src/routes/coordinator.ts — Phase 6: the Ubuntu Town coordinator console.
//
// A coordinator supports a portfolio of community creches. They can:
//   - sign in with their Ubuntu Town (Supabase) account
//   - see every centre they look after, with activation + compliance at a glance
//   - onboard a new creche (collecting the R250 Community fee via Paystack)
//   - "act as" a centre to run the setup wizard on its behalf
//
// Security notes:
//   - /api/coordinator/* bypasses the staff auth middleware, so every handler
//     resolves the coordinator session explicitly via requireCoordinator().
//   - The coordinator session is a SEPARATE cookie from the staff session, so
//     acting-as a centre never overwrites the coordinator's own identity.
//   - Acting as a centre is only possible for centres in the coordinator's
//     portfolio, and every use is written to that centre's audit log. A
//     coordinator can help; a coordinator cannot help invisibly.

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { signJwt, verifyJwt, type JwtPayload } from '../auth';
import {
  SESSION_COOKIE, getCookie, sessionCookie, cookieDomain,
  COORD_COOKIE, coordCookie, clearedCoordCookie,
  isRateLimited, bumpRateLimit,
} from '../lib';
import { initDb } from '../db';
import { verifySupabaseToken, resolveCoordinator, coordinatorOwnsCentre } from '../coordinator';
import { getPlan, paystackInitialize, newReference, formatZar, evaluateAccess } from '../billing';

const r = new Hono<AppEnv>();

const tenantBase = (env: any) => env.TENANT_BASE_DOMAIN || 'daycareos.ubuntutown.co.za';
const appUrl = (env: any) => (env.APP_BASE_URL || `https://app.${tenantBase(env)}`).replace(/\/$/, '');

/** Resolve the coordinator session from its own cookie (or a Bearer token). */
async function requireCoordinator(c: Context<AppEnv>): Promise<{ id: string; email: string; name: string; role: string } | null> {
  const raw = getCookie(c.req.raw, COORD_COOKIE) || (c.req.header('Authorization') || '').replace(/^Bearer /, '');
  if (!raw) return null;
  const payload = await verifyJwt(raw, c.env.JWT_SECRET);
  if (!payload || payload.role !== 'coordinator') return null;
  // Re-check the row every request so deactivating a coordinator takes effect
  // immediately rather than at token expiry.
  const row = await c.env.DB.prepare(
    'SELECT coordinator_id, email, full_name, role, active FROM coordinators WHERE coordinator_id = ?',
  ).bind(payload.sub).first<any>();
  if (!row || !row.active) return null;
  return { id: row.coordinator_id, email: row.email, name: row.full_name || '', role: row.role };
}

// ── POST /api/coordinator/session — exchange a Supabase token ─────
r.post('/coordinator/session', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rlKey = `coordlogin:${ip}`;
  if (await isRateLimited(c.env, rlKey, 10)) {
    return c.json({ ok: false, error: 'Too many attempts. Please wait a few minutes.' }, 429);
  }
  await bumpRateLimit(c.env, rlKey, 900);

  const body = await c.req.json<any>().catch(() => ({}));
  const accessToken = String(body?.access_token || '');
  if (!accessToken) return c.json({ ok: false, error: 'Missing access token.' }, 400);

  const identity = await verifySupabaseToken(c.env, accessToken);
  if (!identity) return c.json({ ok: false, error: 'We could not verify that Ubuntu Town sign-in.' }, 401);

  const coord = await resolveCoordinator(c.env, identity);
  if (!coord) {
    return c.json(
      { ok: false, error: 'That account is not registered as an Ubuntu Town coordinator. Please contact your network administrator.' },
      403,
    );
  }

  const maxAge = 12 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: coord.coordinator_id, role: 'coordinator',
    email: coord.email, name: coord.full_name || identity.name || coord.email,
    iat: now, exp: now + maxAge,
  };
  const jwt = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', coordCookie(jwt, maxAge, cookieDomain(c.env, c.req.header('host'))));

  return c.json({
    ok: true,
    data: { coordinator: { id: coord.coordinator_id, email: coord.email, name: coord.full_name, role: coord.role, town_id: coord.town_id } },
  });
});

// ── POST /api/coordinator/logout ──────────────────────────────────
r.post('/coordinator/logout', (c) => {
  c.header('Set-Cookie', clearedCoordCookie(cookieDomain(c.env, c.req.header('host'))));
  return c.json({ ok: true, data: { loggedOut: true } });
});

// ── GET /api/coordinator/me ───────────────────────────────────────
r.get('/coordinator/me', async (c) => {
  const coord = await requireCoordinator(c);
  if (!coord) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  return c.json({ ok: true, data: coord });
});

// ── GET /api/coordinator/centres — the portfolio ──────────────────
r.get('/coordinator/centres', async (c) => {
  const coord = await requireCoordinator(c);
  if (!coord) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT c.centre_id, c.name, c.slug, c.status, c.plan, c.province, c.official_email, c.created_at,
            s.status AS sub_status, s.paid_until, s.trial_ends_at, s.grace_days,
            (SELECT COUNT(*) FROM children ch WHERE ch.centre_id = c.centre_id AND ch.status = 'active') AS children,
            (SELECT COUNT(*) FROM staff st WHERE st.centre_id = c.centre_id AND st.active = 1) AS staff,
            (SELECT setting_value FROM settings se WHERE se.centre_id = c.centre_id AND se.setting_key = 'setup_complete') AS setup_complete,
            (SELECT COUNT(*) FROM compliance_items ci WHERE ci.centre_id = c.centre_id AND ci.status = 'complete') AS compliance_done,
            (SELECT COUNT(*) FROM compliance_items ci WHERE ci.centre_id = c.centre_id) AS compliance_total
       FROM coordinator_centres cc
       JOIN centres c ON c.centre_id = cc.centre_id
       LEFT JOIN subscriptions s ON s.centre_id = c.centre_id
      WHERE cc.coordinator_id = ?
      ORDER BY c.created_at DESC`,
  ).bind(coord.id).all();

  const centres = (rows.results || []).map((x: any) => {
    const access = evaluateAccess({
      status: x.sub_status, paid_until: x.paid_until, trial_ends_at: x.trial_ends_at, grace_days: x.grace_days,
    });
    const total = Number(x.compliance_total || 0);
    const done = Number(x.compliance_done || 0);
    return {
      centre_id: x.centre_id,
      name: x.name,
      slug: x.slug,
      province: x.province,
      email: x.official_email,
      status: x.status,
      plan: x.plan,
      children: Number(x.children || 0),
      staff: Number(x.staff || 0),
      setup_complete: String(x.setup_complete || 'false') === 'true',
      compliance_percent: total ? Math.round((done / total) * 100) : 0,
      subscription: { status: x.sub_status || 'none', paid_until: x.paid_until, access: access.reason, allowed: access.allowed },
      created_at: x.created_at,
    };
  });

  const summary = {
    total: centres.length,
    active: centres.filter((x) => x.subscription.allowed).length,
    needs_attention: centres.filter((x) => !x.subscription.allowed || !x.setup_complete).length,
    children: centres.reduce((n, x) => n + x.children, 0),
  };

  return c.json({ ok: true, data: { summary, centres } });
});

// ── POST /api/coordinator/centres — onboard a creche (R250) ───────
const NewCentre = z.object({
  centre_name: z.string().trim().min(2).max(120),
  owner_name: z.string().trim().min(2).max(120),
  owner_email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  province: z.string().trim().max(60).optional(),
});

r.post('/coordinator/centres', async (c) => {
  const coord = await requireCoordinator(c);
  if (!coord) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const parsed = NewCentre.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Please provide the centre name, the principal’s name and a valid email.' }, 400);
  }
  const d = parsed.data;

  const plan = await getPlan(c.env.DB, 'community');
  if (!plan) return c.json({ ok: false, error: 'The Community plan is not available.' }, 400);

  const intentId = `intent-${crypto.randomUUID()}`;
  const reference = newReference('udoc');

  await c.env.DB.prepare(
    `INSERT INTO signup_intents (intent_id, centre_name, owner_name, owner_email, phone, province, plan_code, status, provider_ref, coordinator_id)
     VALUES (?, ?, ?, ?, ?, ?, 'community', 'pending', ?, ?)`,
  ).bind(intentId, d.centre_name, d.owner_name, d.owner_email, d.phone || null, d.province || null, reference, coord.id).run();

  await c.env.DB.prepare(
    `INSERT INTO payments (payment_id, intent_id, provider, provider_ref, plan_code, amount_cents, currency, status, payer_email)
     VALUES (?, ?, 'paystack', ?, 'community', ?, ?, 'pending', ?)`,
  ).bind(`pay-${crypto.randomUUID()}`, intentId, reference, plan.price_cents, plan.currency, coord.email).run();

  const init = await paystackInitialize(c.env, {
    email: coord.email, // the coordinator settles the sponsored fee
    amountCents: plan.price_cents,
    reference,
    callbackUrl: `${appUrl(c.env)}/coordinator?ref=${encodeURIComponent(reference)}`,
    currency: plan.currency,
    metadata: { intent_id: intentId, plan_code: 'community', coordinator_id: coord.id, centre_name: d.centre_name },
  });
  if (!init.ok) return c.json({ ok: false, error: init.error || 'Could not start checkout.' }, 502);

  return c.json({
    ok: true,
    data: { authorization_url: init.authorizationUrl, reference, amount: formatZar(plan.price_cents), centre_name: d.centre_name },
  });
});

// ── GET /api/coordinator/centres/:ref/status — poll after payment ─
r.get('/coordinator/intents/:reference', async (c) => {
  const coord = await requireCoordinator(c);
  if (!coord) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const row = await c.env.DB.prepare(
    'SELECT status, centre_name, owner_email, centre_id FROM signup_intents WHERE provider_ref = ? AND coordinator_id = ?',
  ).bind(c.req.param('reference'), coord.id).first<any>();
  if (!row) return c.json({ ok: false, error: 'Unknown reference.' }, 404);
  return c.json({ ok: true, data: row });
});

// ── POST /api/coordinator/act-as/:centreId — set up on their behalf ──
r.post('/coordinator/act-as/:centreId', async (c) => {
  const coord = await requireCoordinator(c);
  if (!coord) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const centreId = c.req.param('centreId');
  if (!(await coordinatorOwnsCentre(c.env, coord.id, centreId))) {
    return c.json({ ok: false, error: 'That centre is not in your portfolio.' }, 403);
  }

  const centre = await c.env.DB.prepare('SELECT centre_id, name, owner_staff_id FROM centres WHERE centre_id = ?')
    .bind(centreId).first<any>();
  if (!centre) return c.json({ ok: false, error: 'Centre not found.' }, 404);

  const owner = await c.env.DB.prepare(
    'SELECT staff_id, full_name, email FROM staff WHERE staff_id = ? AND centre_id = ? AND active = 1',
  ).bind(centre.owner_staff_id, centreId).first<any>();
  if (!owner) return c.json({ ok: false, error: 'That centre has no active owner account.' }, 409);

  // Shorter than a normal session: assistance is meant to be a visit, not a tenancy.
  const maxAge = 2 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: owner.staff_id, role: 'admin', email: owner.email,
    name: `${owner.full_name} (via ${coord.name || coord.email})`,
    centre_id: centreId, iat: now, exp: now + maxAge,
  };
  const jwt = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', sessionCookie(jwt, maxAge, cookieDomain(c.env, c.req.header('host'))));

  // Audit on the CENTRE's own log, so the creche can always see who helped.
  const db = initDb(c.env.DB, centreId);
  await db.insertAudit({
    id: db.uuid(), user_id: owner.staff_id, action: 'coordinator_acted_as', module_name: 'centre',
    record_id: centreId,
    metadata: JSON.stringify({ coordinator_id: coord.id, coordinator_email: coord.email, at: new Date().toISOString() }),
  });

  return c.json({
    ok: true,
    data: {
      centre_id: centreId, centre_name: centre.name,
      user: { id: owner.staff_id, name: owner.full_name, email: owner.email, role: 'admin', centre_id: centreId },
      redirect: '/setup',
    },
  });
});

export default r;
