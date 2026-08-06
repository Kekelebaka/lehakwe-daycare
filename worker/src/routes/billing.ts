// worker/src/routes/billing.ts — Phase 5: paid self-serve SaaS (Paystack, ZAR).
//
// Two purchase journeys, one provisioning path:
//
//  A. PAY-FIRST (public):   form -> signup_intent -> Paystack -> webhook
//     -> provision centre -> email a one-time "get started" link -> wizard.
//     Nothing is provisioned until the money is confirmed server-side.
//
//  B. RENEW/ACTIVATE (authed): an existing centre pays to extend paid_until.
//
// Security posture:
//  - The webhook verifies Paystack's HMAC-SHA512 signature over the RAW body.
//  - It then RE-VERIFIES the transaction against Paystack's API (never trust a
//    webhook body alone) and checks the amount matches the plan price.
//  - Every event is recorded in webhook_events for idempotency, so a Paystack
//    retry can never double-provision or double-extend.

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { signJwt, type JwtPayload } from '../auth';
import { sessionCookie, cookieDomain, isRateLimited, bumpRateLimit, verifyTurnstile, sendEmailViaResend } from '../lib';
import { getCentreId } from '../tenant';
import { provisionCentre } from '../provisioning';
import {
  getPlan,
  paystackInitialize,
  paystackVerify,
  verifyPaystackSignature,
  newReference,
  formatZar,
  addPeriod,
  evaluateAccess,
  PUBLIC_PLANS,
} from '../billing';

const r = new Hono<AppEnv>();

const tenantBase = (env: any) => env.TENANT_BASE_DOMAIN || 'daycareos.ubuntutown.co.za';
const siteUrl = (env: any) => env.PUBLIC_SITE_URL || 'https://daycareos.ubuntutown.co.za';

// ── GET /api/public/plans — what the public may buy ───────────────
r.get('/public/plans', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT plan_code, name, price_cents, currency, period, sponsored, description
     FROM plans WHERE active = 1 ORDER BY price_cents ASC`,
  ).all();
  return c.json({ ok: true, data: rows.results });
});

// ── POST /api/public/checkout — start a paid signup ───────────────
const Checkout = z.object({
  centre_name: z.string().trim().min(2).max(120),
  owner_name: z.string().trim().min(2).max(120),
  owner_email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  province: z.string().trim().max(60).optional(),
  plan_code: z.enum(PUBLIC_PLANS),
  turnstileToken: z.string().optional(),
});

r.post('/public/checkout', async (c) => {
  const parsed = Checkout.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Please provide the centre name, your name, a valid email and a plan.' }, 400);
  }
  const d = parsed.data;

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rlKey = `checkout:${ip}`;
  if (await isRateLimited(c.env, rlKey, 8)) {
    return c.json({ ok: false, error: 'Too many attempts from this network. Please wait a few minutes.' }, 429);
  }
  await bumpRateLimit(c.env, rlKey, 3600);
  if (!(await verifyTurnstile(c.env, d.turnstileToken, ip))) {
    return c.json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  const plan = await getPlan(c.env.DB, d.plan_code);
  if (!plan) return c.json({ ok: false, error: 'That plan is not available.' }, 400);

  const intentId = `intent-${crypto.randomUUID()}`;
  const reference = newReference('udo');

  await c.env.DB.prepare(
    `INSERT INTO signup_intents (intent_id, centre_name, owner_name, owner_email, phone, province, plan_code, status, provider_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).bind(intentId, d.centre_name, d.owner_name, d.owner_email, d.phone || null, d.province || null, d.plan_code, reference).run();

  await c.env.DB.prepare(
    `INSERT INTO payments (payment_id, intent_id, provider, provider_ref, plan_code, amount_cents, currency, status, payer_email)
     VALUES (?, ?, 'paystack', ?, ?, ?, ?, 'pending', ?)`,
  ).bind(`pay-${crypto.randomUUID()}`, intentId, reference, plan.plan_code, plan.price_cents, plan.currency, d.owner_email).run();

  const init = await paystackInitialize(c.env, {
    email: d.owner_email,
    amountCents: plan.price_cents,
    reference,
    callbackUrl: `${siteUrl(c.env)}/welcome?ref=${encodeURIComponent(reference)}`,
    currency: plan.currency,
    metadata: { intent_id: intentId, plan_code: plan.plan_code, centre_name: d.centre_name },
  });

  if (!init.ok) return c.json({ ok: false, error: init.error || 'Could not start checkout.' }, 502);

  return c.json({
    ok: true,
    data: {
      authorization_url: init.authorizationUrl,
      reference,
      amount: formatZar(plan.price_cents),
      plan: plan.name,
    },
  });
});

// ── GET /api/public/checkout/:reference — poll from the return page ──
r.get('/public/checkout/:reference', async (c) => {
  const ref = c.req.param('reference');
  const intent = await c.env.DB.prepare(
    `SELECT status, owner_email, centre_name, slug, plan_code FROM signup_intents WHERE provider_ref = ?`,
  ).bind(ref).first<any>();
  if (!intent) return c.json({ ok: false, error: 'Unknown reference.' }, 404);

  return c.json({
    ok: true,
    data: {
      status: intent.status, // pending | paid | provisioned | failed
      centre_name: intent.centre_name,
      email: intent.owner_email,
      login_url: intent.slug ? `https://${intent.slug}.${tenantBase(c.env)}` : null,
    },
  });
});

// ── POST /api/public/paystack/webhook ─────────────────────────────
r.post('/public/paystack/webhook', async (c) => {
  const raw = await c.req.text();
  const signature = c.req.header('x-paystack-signature') || '';
  const secret = c.env.PAYSTACK_SECRET_KEY || '';

  if (!(await verifyPaystackSignature(raw, signature, secret))) {
    return c.json({ ok: false, error: 'Invalid signature' }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return c.json({ ok: false, error: 'Bad payload' }, 400);
  }

  const reference: string = event?.data?.reference || '';
  const type: string = event?.event || 'unknown';
  // Paystack has no stable event id on all events — hash reference+type+paid_at.
  const eventId = `${type}:${reference}:${event?.data?.paid_at || event?.data?.paidAt || ''}`;

  // Idempotency: if we've already handled this exact event, ack and stop.
  const seen = await c.env.DB.prepare('SELECT 1 AS x FROM webhook_events WHERE event_id = ?').bind(eventId).first();
  if (seen) return c.json({ ok: true, data: { duplicate: true } });
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO webhook_events (event_id, provider, event_type, provider_ref) VALUES (?, ?, ?, ?)',
  ).bind(eventId, 'paystack', type, reference).run();

  if (type !== 'charge.success') return c.json({ ok: true, data: { ignored: type } });

  // Re-verify server-side — never trust the webhook body alone.
  const v = await paystackVerify(c.env, reference);
  if (!v.ok || !v.success) {
    await c.env.DB.prepare(`UPDATE payments SET status = 'failed' WHERE provider_ref = ?`).bind(reference).run();
    return c.json({ ok: true, data: { verified: false } });
  }

  const payment = await c.env.DB.prepare(
    `SELECT payment_id, intent_id, centre_id, plan_code, amount_cents FROM payments WHERE provider_ref = ?`,
  ).bind(reference).first<any>();
  if (!payment) return c.json({ ok: true, data: { unknown_reference: true } });

  // Amount tamper check.
  if (typeof v.amountCents === 'number' && v.amountCents < payment.amount_cents) {
    await c.env.DB.prepare(`UPDATE payments SET status = 'failed', raw = ? WHERE provider_ref = ?`)
      .bind(JSON.stringify({ reason: 'amount_mismatch', got: v.amountCents, want: payment.amount_cents }), reference)
      .run();
    return c.json({ ok: true, data: { amount_mismatch: true } });
  }

  await c.env.DB.prepare(
    `UPDATE payments SET status = 'success', paid_at = ?, channel = ?, raw = ? WHERE provider_ref = ?`,
  ).bind(v.paidAt || new Date().toISOString(), v.channel || null, JSON.stringify(v.raw || {}).slice(0, 8000), reference).run();

  const plan = await getPlan(c.env.DB, payment.plan_code);
  const period = (plan?.period as 'year' | 'month') || 'year';
  const paidUntil = addPeriod(new Date(), period, 1);

  // ── Path B: renewal for an existing centre ──
  if (payment.centre_id) {
    await c.env.DB.prepare(
      `UPDATE subscriptions
         SET status = 'active', paid_until = ?, plan_code = ?, last_payment_id = ?, reminder_sent_at = NULL, updated_at = datetime('now')
       WHERE centre_id = ?`,
    ).bind(paidUntil, payment.plan_code, payment.payment_id, payment.centre_id).run();
    await c.env.DB.prepare(`UPDATE centres SET status = 'active' WHERE centre_id = ?`).bind(payment.centre_id).run();

    const centre = await c.env.DB.prepare('SELECT name, slug, official_email FROM centres WHERE centre_id = ?')
      .bind(payment.centre_id).first<any>();
    if (centre?.official_email) {
      await sendReceipt(c.env, {
        to: centre.official_email,
        centreName: centre.name,
        planName: plan?.name || payment.plan_code,
        amount: formatZar(payment.amount_cents),
        reference,
        paidUntil,
        loginUrl: `https://${centre.slug}.${tenantBase(c.env)}`,
      });
    }
    return c.json({ ok: true, data: { renewed: true } });
  }

  // ── Path A: pay-first signup → provision now ──
  const intent = await c.env.DB.prepare(
    `SELECT * FROM signup_intents WHERE intent_id = ?`,
  ).bind(payment.intent_id).first<any>();
  if (!intent) return c.json({ ok: true, data: { no_intent: true } });
  if (intent.status === 'provisioned') return c.json({ ok: true, data: { already_provisioned: true } });

  const prov = await provisionCentre(c.env.DB, {
    centreName: intent.centre_name,
    ownerName: intent.owner_name,
    ownerEmail: intent.owner_email,
    province: intent.province || undefined,
    planCode: intent.plan_code,
    baseDomain: tenantBase(c.env),
    status: 'active',
    paidUntil,
    coordinatorId: intent.coordinator_id || null,
  });

  await c.env.DB.prepare(
    `UPDATE subscriptions SET last_payment_id = ? WHERE centre_id = ?`,
  ).bind(payment.payment_id, prov.centreId).run();

  await c.env.DB.prepare(
    `UPDATE payments SET centre_id = ? WHERE provider_ref = ?`,
  ).bind(prov.centreId, reference).run();

  await c.env.DB.prepare(
    `UPDATE signup_intents SET status = 'provisioned', centre_id = ?, slug = ?, provisioned_at = datetime('now') WHERE intent_id = ?`,
  ).bind(prov.centreId, prov.slug, intent.intent_id).run();

  // One-time "get started" link (7 days).
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO setup_tokens (token, centre_id, staff_id, purpose, expires_at) VALUES (?, ?, ?, 'setup', ?)`,
  ).bind(token, prov.centreId, prov.staffId, expires).run();

  await sendWelcome(c.env, {
    to: intent.owner_email,
    ownerName: intent.owner_name,
    centreName: intent.centre_name,
    planName: plan?.name || intent.plan_code,
    amount: formatZar(payment.amount_cents),
    reference,
    paidUntil,
    startUrl: `${prov.loginUrl}/welcome?token=${token}`,
    loginUrl: prov.loginUrl,
  });

  return c.json({ ok: true, data: { provisioned: true, slug: prov.slug } });
});

// ── POST /api/public/setup-token — redeem the emailed link ────────
r.post('/public/setup-token', async (c) => {
  const body = await c.req.json<any>().catch(() => ({}));
  const token = String(body?.token || '');
  if (!token) return c.json({ ok: false, error: 'Missing token.' }, 400);

  const row = await c.env.DB.prepare(
    `SELECT t.token, t.centre_id, t.staff_id, t.expires_at, t.used_at, s.full_name, s.email
       FROM setup_tokens t JOIN staff s ON s.staff_id = t.staff_id
      WHERE t.token = ?`,
  ).bind(token).first<any>();

  if (!row) return c.json({ ok: false, error: 'This link is not valid.' }, 404);
  if (row.used_at) return c.json({ ok: false, error: 'This link has already been used. Please sign in instead.' }, 410);
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ ok: false, error: 'This link has expired. Please sign in or request a new one.' }, 410);
  }

  await c.env.DB.prepare(`UPDATE setup_tokens SET used_at = datetime('now') WHERE token = ?`).bind(token).run();

  const maxAge = 12 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: row.staff_id, role: 'admin', email: row.email, name: row.full_name,
    centre_id: row.centre_id, iat: now, exp: now + maxAge,
  };
  const jwt = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', sessionCookie(jwt, maxAge, cookieDomain(c.env)));

  return c.json({
    ok: true,
    data: {
      token: jwt,
      needs_password: true,
      user: { id: row.staff_id, name: row.full_name, email: row.email, role: 'admin', centre_id: row.centre_id },
    },
  });
});

// ── GET /api/billing/status — authed: where does this centre stand? ──
r.get('/billing/status', async (c) => {
  const centreId = getCentreId(c);
  const sub = await c.env.DB.prepare(
    `SELECT plan_code, status, trial_ends_at, paid_until, grace_days FROM subscriptions WHERE centre_id = ?`,
  ).bind(centreId).first<any>();
  const plan = sub ? await getPlan(c.env.DB, sub.plan_code) : null;
  const access = evaluateAccess(sub);
  return c.json({
    ok: true,
    data: {
      plan_code: sub?.plan_code || null,
      plan_name: plan?.name || null,
      price: plan ? formatZar(plan.price_cents) : null,
      status: sub?.status || 'none',
      paid_until: sub?.paid_until || null,
      trial_ends_at: sub?.trial_ends_at || null,
      access,
    },
  });
});

// ── POST /api/billing/checkout — authed: renew / activate ─────────
r.post('/billing/checkout', async (c) => {
  const centreId = getCentreId(c);
  const identity = c.get('identity');
  const body = await c.req.json<any>().catch(() => ({}));

  const centre = await c.env.DB.prepare('SELECT name, slug, official_email FROM centres WHERE centre_id = ?')
    .bind(centreId).first<any>();
  if (!centre) return c.json({ ok: false, error: 'Centre not found.' }, 404);

  const sub = await c.env.DB.prepare('SELECT plan_code FROM subscriptions WHERE centre_id = ?').bind(centreId).first<any>();
  const planCode = String(body?.plan_code || sub?.plan_code || 'self_service');
  const plan = await getPlan(c.env.DB, planCode);
  if (!plan) return c.json({ ok: false, error: 'That plan is not available.' }, 400);

  const email = identity?.email || centre.official_email;
  if (!email) return c.json({ ok: false, error: 'No billing email on file.' }, 400);

  const reference = newReference('udo');
  await c.env.DB.prepare(
    `INSERT INTO payments (payment_id, centre_id, provider, provider_ref, plan_code, amount_cents, currency, status, payer_email)
     VALUES (?, ?, 'paystack', ?, ?, ?, ?, 'pending', ?)`,
  ).bind(`pay-${crypto.randomUUID()}`, centreId, reference, plan.plan_code, plan.price_cents, plan.currency, email).run();

  const host = centre.slug ? `https://${centre.slug}.${tenantBase(c.env)}` : siteUrl(c.env);
  const init = await paystackInitialize(c.env, {
    email,
    amountCents: plan.price_cents,
    reference,
    callbackUrl: `${host}/billing?ref=${encodeURIComponent(reference)}`,
    currency: plan.currency,
    metadata: { centre_id: centreId, plan_code: plan.plan_code },
  });
  if (!init.ok) return c.json({ ok: false, error: init.error || 'Could not start checkout.' }, 502);

  return c.json({ ok: true, data: { authorization_url: init.authorizationUrl, reference, amount: formatZar(plan.price_cents) } });
});

// ── Emails ────────────────────────────────────────────────────────
async function sendWelcome(env: any, m: {
  to: string; ownerName: string; centreName: string; planName: string;
  amount: string; reference: string; paidUntil: string; startUrl: string; loginUrl: string;
}) {
  const until = new Date(m.paidUntil).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  await sendEmailViaResend(env, {
    to: m.to,
    fromName: 'Ubuntu Daycare OS',
    fromEmail: `info@${env.SENDING_DOMAIN}`,
    subject: `${m.centreName} is live on Ubuntu Daycare OS 🎉`,
    text:
      `Dumela ${m.ownerName},\n\n` +
      `Thank you — your payment was received and ${m.centreName} is now set up on Ubuntu Daycare OS.\n\n` +
      `START HERE (one-time link, valid 7 days):\n${m.startUrl}\n\n` +
      `That link signs you in and walks you through setup: your centre details, fees, staff and children.\n\n` +
      `Your permanent address is:\n${m.loginUrl}\n\n` +
      `── Receipt ──\n` +
      `Plan: ${m.planName}\nAmount: ${m.amount}\nReference: ${m.reference}\nPaid up until: ${until}\n\n` +
      `We'll remind you before your next renewal. Reply to this email if you need a hand.\n\n` +
      `Stronger Centres. Brighter Futures. Together.\n` +
      `Ubuntu Daycare OS — Powered by ChiefOps`,
  });
}

async function sendReceipt(env: any, m: {
  to: string; centreName: string; planName: string; amount: string;
  reference: string; paidUntil: string; loginUrl: string;
}) {
  const until = new Date(m.paidUntil).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  await sendEmailViaResend(env, {
    to: m.to,
    fromName: 'Ubuntu Daycare OS',
    fromEmail: `info@${env.SENDING_DOMAIN}`,
    subject: `Payment received — ${m.centreName} is active until ${until}`,
    text:
      `Thank you — we've received your payment for ${m.centreName}.\n\n` +
      `Plan: ${m.planName}\nAmount: ${m.amount}\nReference: ${m.reference}\nActive until: ${until}\n\n` +
      `Sign in: ${m.loginUrl}\n\n` +
      `Ubuntu Daycare OS — Powered by ChiefOps`,
  });
}

export default r;
