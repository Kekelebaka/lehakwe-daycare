// Shared helpers for the Worker API: sessions, rate-limiting, Turnstile, email, RBAC.
import type { Env } from './env';

// ── Session cookie ───────────────────────────────────────────────
export const SESSION_COOKIE = 'lehakwe_session';
const COOKIE_DOMAIN = '.lehakwedaycare.co.za';

export function getCookie(request: Request, name: string): string {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/',
    `Domain=${COOKIE_DOMAIN}`, `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=0`;
}

// ── Authorization ────────────────────────────────────────────────
export function isAdmin(role?: string): boolean {
  return role === 'admin' || role === 'owner';
}

// Operations that require an admin/owner token regardless of what the client shows.
export function requiresAdmin(method: string, path: string): boolean {
  const m = method.toUpperCase();
  const rules: Array<[RegExp, string[]]> = [
    [/^\/api\/staff$/, ['POST']],
    [/^\/api\/staff\/[^/]+$/, ['PUT', 'DELETE']],
    [/^\/api\/payslips(\/.*)?$/, ['GET', 'POST', 'PUT', 'DELETE']],
    [/^\/api\/settings$/, ['PUT']],
    [/^\/api\/audit$/, ['GET']],
    [/^\/api\/parents\/[^/]+$/, ['DELETE']],
    [/^\/api\/children\/[^/]+$/, ['DELETE']],
    [/^\/api\/documents\/[^/]+$/, ['DELETE']],
    [/^\/api\/compliance\//, ['PUT']],
    [/^\/api\/fees\/schedules$/, ['POST']],
    [/^\/api\/leave\/[^/]+$/, ['PUT', 'DELETE']],
  ];
  for (const [re, methods] of rules) if (re.test(path) && methods.includes(m)) return true;
  return false;
}

// ── Turnstile (optional until TURNSTILE_SECRET is set) ───────────
export async function verifyTurnstile(env: Env, token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

// ── Login rate-limiting (optional until RATE_LIMIT KV is bound) ──
export async function isRateLimited(env: Env, key: string, limit = 5): Promise<boolean> {
  if (!env.RATE_LIMIT) return false;
  const raw = await env.RATE_LIMIT.get(key);
  return (raw ? parseInt(raw) : 0) >= limit;
}
export async function bumpRateLimit(env: Env, key: string, windowSec = 900): Promise<void> {
  if (!env.RATE_LIMIT) return;
  const raw = await env.RATE_LIMIT.get(key);
  await env.RATE_LIMIT.put(key, String((raw ? parseInt(raw) : 0) + 1), { expirationTtl: windowSec });
}
export async function clearRateLimit(env: Env, key: string): Promise<void> {
  if (env.RATE_LIMIT) await env.RATE_LIMIT.delete(key);
}

// ── Outbound email via Resend (records-only until RESEND_API_KEY set) ──
export async function sendEmailViaResend(
  env: Env,
  msg: { to: string; fromName: string; fromEmail: string; subject: string; text: string },
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !msg.to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${msg.fromName} <${msg.fromEmail}>`, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
