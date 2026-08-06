import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { signJwt, verifyJwt, verifyPassword, hashPassword, type JwtPayload } from '../auth';
import { SESSION_COOKIE, getCookie, sessionCookie, clearedCookie, cookieDomain, isRateLimited, bumpRateLimit, clearRateLimit, verifyTurnstile } from '../lib';
import { DEFAULT_CENTRE_ID, getCentreId } from '../tenant';

const r = new Hono<AppEnv>();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

// POST /api/auth/login (public)
r.post('/auth/login', async (c) => {
  const parsed = LoginBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Email and password required' }, 400);
  const { email, password, turnstileToken } = parsed.data;

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rlKey = `login:${ip}:${email.toLowerCase()}`;
  if (await isRateLimited(c.env, rlKey)) {
    return c.json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
  }
  if (!(await verifyTurnstile(c.env, turnstileToken, ip))) {
    await bumpRateLimit(c.env, rlKey);
    return c.json({ ok: false, error: 'Verification failed. Please try again.' }, 400);
  }

  const db = initDb(c.env.DB);
  const staff = await db.DB.prepare('SELECT * FROM staff WHERE email = ? AND active = 1 LIMIT 1').bind(email).first<any>();
  if (!staff || !staff.password_hash) {
    await bumpRateLimit(c.env, rlKey);
    return c.json({ ok: false, error: 'Invalid credentials' }, 401);
  }
  if (!(await verifyPassword(password, staff.password_hash))) {
    await bumpRateLimit(c.env, rlKey);
    return c.json({ ok: false, error: 'Invalid credentials' }, 401);
  }
  await clearRateLimit(c.env, rlKey);

  const role = staff.job_title === 'Centre Manager' || staff.job_title === 'Daycare Principal' ? 'admin' : 'staff';
  const centre_id = staff.centre_id || DEFAULT_CENTRE_ID;
  const maxAge = 12 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { sub: staff.staff_id, role, email: staff.email, name: staff.full_name, centre_id, iat: now, exp: now + maxAge };
  const token = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', sessionCookie(token, maxAge, cookieDomain(c.env, c.req.header('host'))));
  return c.json({ ok: true, data: { token, user: { id: staff.staff_id, name: staff.full_name, email: staff.email, role, centre_id, signature: staff.signature || '' } } });
});

// POST /api/auth/logout (public)
r.post('/auth/logout', (c) => {
  c.header('Set-Cookie', clearedCookie(cookieDomain(c.env, c.req.header('host'))));
  return c.json({ ok: true, data: { loggedOut: true } });
});

// POST /api/auth/set-password
// Phase 5: a centre bought via Paystack is provisioned with an unguessable
// random password and the owner arrives through a one-time emailed link. This
// lets them choose a real password so they can sign in normally afterwards.
// /api/auth/* bypasses the global auth middleware, so the session is verified
// here explicitly. Possession of a valid session (proved by the emailed link,
// or by an existing login) is the authorisation.
r.post('/auth/set-password', async (c) => {
  const token = getCookie(c.req.raw, SESSION_COOKIE) || (c.req.header('Authorization') || '').replace(/^Bearer /, '');
  const identity = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!identity) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const body = await c.req.json<any>().catch(() => ({}));
  const next = String(body?.new_password || '');
  if (next.length < 8 || next.length > 200) {
    return c.json({ ok: false, error: 'Choose a password of at least 8 characters.' }, 400);
  }

  const staff = await c.env.DB.prepare('SELECT staff_id, password_hash FROM staff WHERE staff_id = ? AND active = 1')
    .bind(identity.sub).first<any>();
  if (!staff) return c.json({ ok: false, error: 'Staff record not found' }, 404);

  // If the caller knows their current password, require it to match (guards a
  // hijacked session on an established account). Accounts created by the paid
  // flow have a random secret nobody knows, so this is optional by design.
  const current = String(body?.current_password || '');
  if (current && !(await verifyPassword(current, staff.password_hash))) {
    return c.json({ ok: false, error: 'Current password is incorrect.' }, 401);
  }

  await c.env.DB.prepare(`UPDATE staff SET password_hash = ?, updated_at = datetime('now') WHERE staff_id = ?`)
    .bind(await hashPassword(next), identity.sub).run();

  return c.json({ ok: true, data: { updated: true } });
});

// GET /api/me (protected)
r.get('/me', async (c) => {
  const identity = c.get('identity');
  if (!identity) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const db = initDb(c.env.DB, getCentreId(c));
  const staffRow = await db.DB.prepare('SELECT * FROM staff WHERE staff_id = ? AND active = 1 AND centre_id = ? LIMIT 1').bind(identity.sub, getCentreId(c)).first<any>();
  if (!staffRow) return c.json({ ok: false, error: 'Staff record not found' }, 404);
  return c.json({ ok: true, data: { id: staffRow.staff_id, name: staffRow.full_name, email: staffRow.email, role: identity.role, centre_id: staffRow.centre_id, signature: staffRow.signature || '', active: staffRow.active } });
});

export default r;
