// Shared helpers for the Worker API: sessions, rate-limiting, Turnstile, email, RBAC.
import type { Env } from './env';

// ── Session cookie ───────────────────────────────────────────────
export const SESSION_COOKIE = 'lehakwe_session';
export const DEFAULT_COOKIE_DOMAIN = '.lehakwedaycare.co.za';
// Per-instance cookie domain — the demo/tenant workers set COOKIE_DOMAIN; defaults to Lehakwe.
export function cookieDomain(env: { COOKIE_DOMAIN?: string }): string {
  return env.COOKIE_DOMAIN || DEFAULT_COOKIE_DOMAIN;
}

export function getCookie(request: Request, name: string): string {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

export function sessionCookie(token: string, maxAgeSeconds: number, domain: string = DEFAULT_COOKIE_DOMAIN): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/',
    `Domain=${domain}`, `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function clearedCookie(domain: string = DEFAULT_COOKIE_DOMAIN): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=${domain}; Max-Age=0`;
}

// Parent session cookie (separate name so parent + staff sessions never collide).
export const PARENT_COOKIE = 'lehakwe_parent';
export function parentSessionCookie(token: string, maxAgeSeconds: number, domain: string = DEFAULT_COOKIE_DOMAIN): string {
  return [
    `${PARENT_COOKIE}=${token}`,
    'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/',
    `Domain=${domain}`, `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}
export function clearedParentCookie(domain: string = DEFAULT_COOKIE_DOMAIN): string {
  return `${PARENT_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=${domain}; Max-Age=0`;
}

// SHA-256 hex — OTP codes are stored hashed, never in plaintext.
export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
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
    [/^\/api\/notifications$/, ['GET']],
    [/^\/api\/notifications\/fee-reminders$/, ['POST']],
    [/^\/api\/notifications\/dispatch$/, ['POST']],
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

// ── OTP delivery: email works now (Resend); SMS/WhatsApp is pluggable ──
export async function sendOtp(
  env: Env,
  msg: { identifier: string; isEmail: boolean; code: string; parentName?: string },
): Promise<boolean> {
  const { identifier, isEmail, code, parentName } = msg;
  if (isEmail) {
    const loginUrl = `https://app.lehakwedaycare.co.za/parent-login?e=${encodeURIComponent(identifier)}`;
    return sendEmailViaResend(env, {
      to: identifier,
      fromName: 'Ubuntu Daycare OS',
      fromEmail: `info@${env.SENDING_DOMAIN}`,
      subject: `Your Ubuntu Daycare OS sign-in code: ${code}`,
      text: `Hi ${parentName || 'there'},\n\nYour sign-in code is ${code}. It expires in 10 minutes.\n\nOpen ${loginUrl} and enter the code to see your child's updates.\n\nUbuntu Daycare OS — Powered by ChiefOps`,
    });
  }
  // SMS / WhatsApp: set SMS_PROVIDER_URL + SMS_PROVIDER_KEY to enable delivery.
  if (env.SMS_PROVIDER_URL && env.SMS_PROVIDER_KEY) {
    try {
      const res = await fetch(env.SMS_PROVIDER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SMS_PROVIDER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: identifier, message: `Your Ubuntu Daycare OS code is ${code} (valid 10 min).` }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  console.warn('OTP SMS delivery not configured; code not delivered for', identifier);
  return false;
}
