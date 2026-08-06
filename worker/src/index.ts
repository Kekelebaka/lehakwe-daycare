import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ForwardableEmailMessage } from '@cloudflare/workers-types';
import { EmailMessage } from 'cloudflare:email';
import { initDb } from './db';
import { parseIncomingEmail, buildAutoReply, buildReplyRaw } from './email-handler';
import { verifyJwt } from './auth';
import type { AppEnv, Env } from './env';
import { SESSION_COOKIE, getCookie, requiresAdmin, isAdmin, tenantBaseDomain } from './lib';
import { centreForHost, DEFAULT_CENTRE_ID } from './tenant';

import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import dashboardRoutes from './routes/dashboard';
import peopleRoutes from './routes/people';
import financeRoutes from './routes/finance';
import careRoutes from './routes/care';
import commsRoutes from './routes/comms';
import adminRoutes from './routes/admin';
import mediaRoutes from './routes/media';
import parentRoutes from './routes/parent';
import messageRoutes from './routes/messages';
import notificationRoutes from './routes/notifications';
import fundingRoutes from './routes/funding';
import billingRoutes from './routes/billing';
import { evaluateAccess } from './billing';
import { dispatchPending, resetStaleSending } from './notifications';

const app = new Hono<AppEnv>();

// ── CORS (credentialed, restricted to configured origins) ────────
// Phase 5: an ALLOWED_ORIGIN entry may be exact ("https://app.example.com") or
// a single-label wildcard ("https://*.daycareos.ubuntutown.co.za"), so every
// tenant subdomain is permitted without enumerating them one by one.
export function originAllowed(origin: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (p === origin) return true;
    if (p.includes('*')) {
      const rx = new RegExp(
        '^' + p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+') + '$',
        'i',
      );
      if (rx.test(origin)) return true;
    }
  }
  return false;
}

app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  // Self-serve tenants each get their own subdomain, so always trust the tenant
  // apex and one level beneath it without having to enumerate centres in config.
  const base = tenantBaseDomain(c.env);
  allowed.push(`https://${base}`, `https://*.${base}`);
  const handler = cors({
    origin: (origin) => (origin && originAllowed(origin, allowed) ? origin : allowed[0] || '*'),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  });
  return handler(c, next);
});

// ── Fail closed if the JWT signing secret is missing ─────────────
app.use('/api/*', async (c, next) => {
  if (!c.env.JWT_SECRET) return c.json({ ok: false, error: 'Server misconfigured' }, 500);
  await next();
});

// ── Authentication + server-side RBAC (public paths bypass) ──────
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;
  const isPublic = path.startsWith('/api/public/') || path === '/api/health' || path.startsWith('/api/auth/') || path.startsWith('/api/parent/');
  c.set('identity', null);
  if (!isPublic) {
    const authHeader = c.req.header('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    // Prefer the httpOnly session cookie; fall back to a Bearer token.
    const token = getCookie(c.req.raw, SESSION_COOKIE) || bearer;
    const identity = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
    if (!identity) return c.json({ ok: false, error: 'Unauthorized' }, 401);
    if (requiresAdmin(method, path) && !isAdmin(identity.role)) {
      return c.json({ ok: false, error: 'Forbidden — admin access required' }, 403);
    }
    c.set('identity', identity);

    // ── Tenant resolution: the centre comes from the verified session (never the
    // client). Secondary defense-in-depth: if the request Origin maps to a known
    // centre, it must match the session's centre. ────────────────────────────
    const centre = identity.centre_id || DEFAULT_CENTRE_ID;
    const origin = c.req.header('Origin') || '';
    if (origin) {
      try {
        const hostCentre = await centreForHost(c.env, new URL(origin).host);
        if (hostCentre && hostCentre !== centre) {
          return c.json({ ok: false, error: 'Forbidden — tenant mismatch' }, 403);
        }
      } catch { /* malformed Origin header — ignore */ }
    }
    c.set('centreId', centre);
  }
  await next();
});

// ── Phase 5: subscription gate ────────────────────────────────────
// Decides whether a centre may still use the product. Deliberately narrow:
//  - only runs when BILLING_ENFORCED === 'true' (kill switch);
//  - always lets billing + auth through, so a lapsed centre can still sign in
//    and pay its way back in;
//  - fails OPEN on any lookup error and for centres with no subscription row,
//    because locking a real daycare out of its own children's records is a far
//    worse failure than a day of unpaid access.
// Returns 402 with a machine-readable code the app renders as a paywall.
app.use('/api/*', async (c, next) => {
  if (c.env.BILLING_ENFORCED !== 'true') return next();

  const path = c.req.path;
  const exempt =
    path.startsWith('/api/public/') ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/parent/') ||
    path.startsWith('/api/billing/') ||
    path === '/api/health' ||
    path === '/api/me';
  if (exempt) return next();

  const centreId = c.get('centreId');
  if (!centreId) return next();

  try {
    const sub = await c.env.DB.prepare(
      'SELECT status, paid_until, trial_ends_at, grace_days FROM subscriptions WHERE centre_id = ?',
    ).bind(centreId).first<any>();

    const access = evaluateAccess(sub);
    if (!access.allowed) {
      return c.json(
        {
          ok: false,
          error:
            access.reason === 'suspended'
              ? 'This centre has been suspended. Please contact support.'
              : 'Your subscription has lapsed. Please renew to continue.',
          code: 'subscription_required',
          data: { reason: access.reason, paid_until: access.paidUntil ?? null },
        },
        402,
      );
    }
  } catch (e) {
    console.error('billing gate lookup failed (failing open):', e);
  }

  await next();
});

// ── Routes ───────────────────────────────────────────────────────
app.route('/api', authRoutes);
app.route('/api', publicRoutes);
app.route('/api', dashboardRoutes);
app.route('/api', peopleRoutes);
app.route('/api', financeRoutes);
app.route('/api', careRoutes);
app.route('/api', commsRoutes);
app.route('/api', adminRoutes);
app.route('/api', mediaRoutes);
app.route('/api', parentRoutes);
app.route('/api', messageRoutes);
app.route('/api', notificationRoutes);
app.route('/api', fundingRoutes);
app.route('/api', billingRoutes);

app.notFound((c) => c.json({ ok: false, error: 'Endpoint not found' }, 404));
app.onError((err, c) => {
  console.error('API error:', err);
  return c.json({ ok: false, error: 'Internal error' }, 500);
});

// ── Email Workers handler (inbound intake, forwarding, auto-reply) ──
async function email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
  const db = initDb(env.DB);
  const parsed = await parseIncomingEmail(message);
  const threadId = db.uuid();
  const fromMatch = parsed.from.match(/<(.+?)>$/);
  const fromEmail = fromMatch ? fromMatch[1] : parsed.from;

  await db.insertMessage({
    id: db.uuid(), thread_id: threadId, direction: 'inbound', from_email: fromEmail, from_name: parsed.from_name,
    to_email: parsed.to, subject: parsed.subject, body_text: parsed.text, body_html: '', raw_email_ref: '', status: 'new', assigned_to: null,
  });

  const forwardEmails = env.FORWARD_EMAILS.split(',').map((e) => e.trim()).filter(Boolean);
  for (const staffEmail of forwardEmails) {
    try {
      const fwdHeaders = new Headers();
      fwdHeaders.set('subject', `[New Enquiry] ${parsed.subject}`);
      await message.forward(staffEmail, fwdHeaders);
    } catch (e) {
      console.error(`Failed to forward to ${staffEmail}:`, e);
    }
  }

  if (env.AUTO_REPLY_ENABLED === 'true') {
    try {
      const replyRaw = buildReplyRaw(`info@${env.SENDING_DOMAIN}`, 'Lehakwe Daycare', fromEmail, `Re: ${parsed.subject}`, buildAutoReply(parsed.from_name));
      const replyMsg = new EmailMessage(`info@${env.SENDING_DOMAIN}`, fromEmail, replyRaw);
      await message.reply(replyMsg);
    } catch (e) {
      console.error('Failed to send auto-reply:', e);
    }
  }

  await db.insertAudit({ id: db.uuid(), thread_id: threadId, staff_id: 'system', action: 'received', metadata: JSON.stringify({ from: parsed.from, subject: parsed.subject, forwarded_to: forwardEmails }) });
}

// ── Cron trigger: flush the notification outbox (retry safety-net; prompt
// delivery still happens inline via waitUntil at each enqueue point) ──
async function scheduled(_event: any, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil((async () => {
    await resetStaleSending(env);
    await dispatchPending(env, 100);
  })());
}

export default { fetch: app.fetch, email, scheduled };
