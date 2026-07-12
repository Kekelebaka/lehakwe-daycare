import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ForwardableEmailMessage } from '@cloudflare/workers-types';
import { EmailMessage } from 'cloudflare:email';
import { initDb } from './db';
import { parseIncomingEmail, buildAutoReply, buildReplyRaw } from './email-handler';
import { verifyJwt } from './auth';
import type { AppEnv, Env } from './env';
import { SESSION_COOKIE, getCookie, requiresAdmin, isAdmin } from './lib';

import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import dashboardRoutes from './routes/dashboard';
import peopleRoutes from './routes/people';
import financeRoutes from './routes/finance';
import careRoutes from './routes/care';
import commsRoutes from './routes/comms';
import adminRoutes from './routes/admin';
import mediaRoutes from './routes/media';

const app = new Hono<AppEnv>();

// ── CORS (credentialed, restricted to configured origins) ────────
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  const handler = cors({
    origin: (origin) => (origin && allowed.includes(origin) ? origin : allowed[0] || '*'),
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
  const isPublic = path.startsWith('/api/public/') || path === '/api/health' || path.startsWith('/api/auth/');
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

export default { fetch: app.fetch, email };
