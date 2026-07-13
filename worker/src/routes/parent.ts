import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { signJwt, verifyJwt, type JwtPayload } from '../auth';
import {
  PARENT_COOKIE, getCookie, parentSessionCookie, clearedParentCookie, cookieDomain,
  sha256hex, timingSafeEqualStr, isRateLimited, bumpRateLimit, sendOtp,
} from '../lib';
import { getOrCreateThread, markThreadRead, insertThreadMessage } from '../messaging';

const r = new Hono<AppEnv>();

// Resolve the signed-in parent from the parent cookie (returns null if none).
async function currentParent(c: any): Promise<JwtPayload | null> {
  const token = getCookie(c.req.raw, PARENT_COOKIE);
  if (!token) return null;
  const p = await verifyJwt(token, c.env.JWT_SECRET);
  return p && p.role === 'parent' ? p : null;
}

const RequestBody = z.object({ identifier: z.string().min(3) });

// POST /api/parent/request-otp (public) — send a one-time code. Anti-enumeration: always ok.
r.post('/parent/request-otp', async (c) => {
  const parsed = RequestBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Enter your phone number or email.' }, 400);
  const raw = parsed.data.identifier.trim();
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rlKey = `otp:${ip}:${raw.toLowerCase()}`;
  if (await isRateLimited(c.env, rlKey, 5)) return c.json({ ok: false, error: 'Too many requests. Please wait a few minutes.' }, 429);
  await bumpRateLimit(c.env, rlKey);

  const isEmail = raw.includes('@');
  const db = initDb(c.env.DB);
  let parent: any = null;
  if (isEmail) {
    parent = await c.env.DB.prepare('SELECT parent_id, full_name, email FROM parents WHERE lower(email) = lower(?) LIMIT 1').bind(raw).first();
  } else {
    const last9 = raw.replace(/\D/g, '').slice(-9);
    if (last9.length >= 6) {
      parent = await c.env.DB.prepare(
        "SELECT parent_id, full_name, email FROM parents WHERE replace(replace(replace(coalesce(phone,''),' ',''),'+',''),'-','') LIKE ? LIMIT 1",
      ).bind(`%${last9}`).first();
    }
  }

  if (parent) {
    const code = c.env.DEMO_MODE === 'true' ? '123456' : String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const codeHash = await sha256hex(`${code}:${c.env.JWT_SECRET}`);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await c.env.DB.prepare('UPDATE otp_codes SET consumed = 1 WHERE identifier = ? AND consumed = 0').bind(raw.toLowerCase()).run();
    await c.env.DB.prepare(
      'INSERT INTO otp_codes (otp_id, identifier, channel, code_hash, parent_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(db.uuid(), raw.toLowerCase(), isEmail ? 'email' : 'sms', codeHash, parent.parent_id, expires).run();
    await sendOtp(c.env, { identifier: raw, isEmail, code, parentName: parent.full_name });
  }
  return c.json({ ok: true, data: { sent: true, channel: isEmail ? 'email' : 'sms' } });
});

const VerifyBody = z.object({ identifier: z.string().min(3), code: z.string().min(4) });

// POST /api/parent/verify-otp (public) — verify code, set parent session cookie.
r.post('/parent/verify-otp', async (c) => {
  const parsed = VerifyBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Enter the code we sent you.' }, 400);
  const id = parsed.data.identifier.trim().toLowerCase();
  const code = parsed.data.code.trim();

  const row = await c.env.DB.prepare('SELECT * FROM otp_codes WHERE identifier = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1').bind(id).first<any>();
  if (!row) return c.json({ ok: false, error: 'Invalid or expired code. Request a new one.' }, 401);
  if (new Date(row.expires_at).getTime() < Date.now()) return c.json({ ok: false, error: 'Code expired. Request a new one.' }, 401);
  if ((row.attempts || 0) >= 5) return c.json({ ok: false, error: 'Too many attempts. Request a new code.' }, 429);

  const codeHash = await sha256hex(`${code}:${c.env.JWT_SECRET}`);
  if (!timingSafeEqualStr(codeHash, row.code_hash)) {
    await c.env.DB.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE otp_id = ?').bind(row.otp_id).run();
    return c.json({ ok: false, error: 'Incorrect code.' }, 401);
  }
  await c.env.DB.prepare('UPDATE otp_codes SET consumed = 1 WHERE otp_id = ?').bind(row.otp_id).run();

  const parent = await c.env.DB.prepare('SELECT parent_id, full_name, email FROM parents WHERE parent_id = ?').bind(row.parent_id).first<any>();
  if (!parent) return c.json({ ok: false, error: 'Account not found.' }, 404);

  const maxAge = 30 * 24 * 60 * 60; // 30 days (parent convenience)
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { sub: parent.parent_id, role: 'parent', email: parent.email || '', name: parent.full_name || 'Parent', iat: now, exp: now + maxAge };
  const token = await signJwt(payload, c.env.JWT_SECRET);
  c.header('Set-Cookie', parentSessionCookie(token, maxAge, cookieDomain(c.env)));
  return c.json({ ok: true, data: { parent: { id: parent.parent_id, name: parent.full_name } } });
});

// POST /api/parent/logout (public) — clear the parent cookie.
r.post('/parent/logout', (c) => {
  c.header('Set-Cookie', clearedParentCookie(cookieDomain(c.env)));
  return c.json({ ok: true, data: { loggedOut: true } });
});

// GET /api/parent/me — parent profile + their children.
r.get('/parent/me', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const children = await c.env.DB.prepare('SELECT child_id, full_name, age_group, status FROM children WHERE parent_id = ? ORDER BY full_name').bind(p.sub).all();
  return c.json({ ok: true, data: { parent: { id: p.sub, name: p.name }, children: children.results } });
});

// GET /api/parent/child/:id — a child's dashboard, ONLY if it belongs to this parent.
r.get('/parent/child/:id', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const childId = c.req.param('id');
  const child = await c.env.DB.prepare('SELECT child_id, full_name, date_of_birth, age_group, status FROM children WHERE child_id = ? AND parent_id = ?').bind(childId, p.sub).first();
  if (!child) return c.json({ ok: false, error: 'Not found' }, 404);

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const attendance = await c.env.DB.prepare("SELECT * FROM attendance_records WHERE child_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ? ORDER BY date DESC").bind(childId, month, year).all();
  const fees = await c.env.DB.prepare('SELECT * FROM fee_records WHERE child_id = ? ORDER BY year DESC, month DESC LIMIT 12').bind(childId).all();
  const notices = await c.env.DB.prepare('SELECT * FROM notices WHERE published = 1 ORDER BY pinned DESC, created_at DESC LIMIT 10').all();
  const media = await c.env.DB.prepare('SELECT media_id, caption, created_at FROM media WHERE child_id = ? ORDER BY created_at DESC LIMIT 24').bind(childId).all();
  const totalDue = fees.results.reduce((s: number, f: any) => s + (f.amount_due || 0), 0);
  const totalPaid = fees.results.reduce((s: number, f: any) => s + (f.amount_paid || 0), 0);
  return c.json({
    ok: true,
    data: { child, attendance: attendance.results, fees: fees.results, notices: notices.results, media: media.results, balance: { total_due: totalDue, total_paid: totalPaid, outstanding: totalDue - totalPaid } },
  });
});

// GET /api/parent/media/:id — cookie-gated, ownership-checked image stream.
r.get('/parent/media/:id', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const row = await c.env.DB.prepare(
    'SELECT m.r2_key, m.content_type FROM media m JOIN children c ON m.child_id = c.child_id WHERE m.media_id = ? AND c.parent_id = ?',
  ).bind(c.req.param('id'), p.sub).first<any>();
  if (!row) return c.json({ ok: false, error: 'Not found' }, 404);
  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ ok: false, error: 'Not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': row.content_type || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
});

// ── Two-way messaging (parent side) — mirrors /api/messages/* on the staff side ──
const MsgBody = z.object({ body: z.string().trim().min(1).max(4000) });

// GET /api/parent/messages — the parent's children with unread counts (staff→parent).
r.get('/parent/messages', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const rows = await c.env.DB.prepare(
    `SELECT c.child_id, c.full_name AS child_name,
            t.thread_id, t.last_message_at,
            (SELECT body FROM thread_messages WHERE thread_id = t.thread_id ORDER BY created_at DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM thread_messages WHERE thread_id = t.thread_id AND sender_type = 'staff' AND read_at IS NULL) AS unread
     FROM children c
     LEFT JOIN message_threads t ON t.child_id = c.child_id
     WHERE c.parent_id = ?
     ORDER BY (t.last_message_at IS NULL), t.last_message_at DESC, c.full_name ASC`,
  ).bind(p.sub).all();
  return c.json({ ok: true, data: rows.results });
});

// GET /api/parent/messages/:childId — a child's conversation, ONLY if it's this parent's child.
r.get('/parent/messages/:childId', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const childId = c.req.param('childId');
  const child = await c.env.DB.prepare('SELECT child_id, full_name FROM children WHERE child_id = ? AND parent_id = ?').bind(childId, p.sub).first<any>();
  if (!child) return c.json({ ok: false, error: 'Not found' }, 404);
  const t = await getOrCreateThread(c.env.DB, childId);
  if (!t) return c.json({ ok: false, error: 'Not found' }, 404);
  await markThreadRead(c.env.DB, t.thread_id, 'parent');
  const msgs = await c.env.DB.prepare(
    'SELECT message_id, sender_type, sender_name, body, read_at, created_at FROM thread_messages WHERE thread_id = ? ORDER BY created_at ASC',
  ).bind(t.thread_id).all();
  return c.json({ ok: true, data: { thread_id: t.thread_id, child, messages: msgs.results } });
});

// POST /api/parent/messages/:childId — parent replies to the centre.
r.post('/parent/messages/:childId', async (c) => {
  const p = await currentParent(c);
  if (!p) return c.json({ ok: false, error: 'Not signed in' }, 401);
  const parsed = MsgBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Message cannot be empty.' }, 400);
  const childId = c.req.param('childId');
  const child = await c.env.DB.prepare('SELECT child_id FROM children WHERE child_id = ? AND parent_id = ?').bind(childId, p.sub).first<any>();
  if (!child) return c.json({ ok: false, error: 'Not found' }, 404);
  const t = await getOrCreateThread(c.env.DB, childId);
  if (!t) return c.json({ ok: false, error: 'Not found' }, 404);
  const msg = await insertThreadMessage(c.env.DB, t.thread_id, 'parent', p.sub, p.name || 'Parent', parsed.data.body);
  return c.json({ ok: true, data: msg });
});

export default r;
