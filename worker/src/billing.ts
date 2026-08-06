// worker/src/billing.ts — Phase 5: Paystack billing (ZAR, annual pay-once).
//
// Model: the buyer pays ONCE for a year. There is no card on file and no
// recurring charge. `subscriptions.paid_until` is the source of truth for
// access; a reminder goes out before it lapses, then a grace period, then
// suspension. This keeps us off recurring-mandate complexity and matches how
// ECD centres actually budget.
//
// Amounts are ZAR CENTS everywhere (Paystack's ZAR subunit is the cent).
// R599.00 -> 59900.

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from './env';

const PAYSTACK_API = 'https://api.paystack.co';

export interface Plan {
  plan_code: string;
  name: string;
  price_cents: number;
  currency: string;
  period: 'year' | 'month';
  sponsored: number;
}

/** Plans a member of the public may purchase directly. */
export const PUBLIC_PLANS = ['self_service', 'community'] as const;

export async function getPlan(db: D1Database, planCode: string): Promise<Plan | null> {
  return await db
    .prepare('SELECT plan_code, name, price_cents, currency, period, sponsored FROM plans WHERE plan_code = ? AND active = 1')
    .bind(planCode)
    .first<Plan>();
}

/** Human-friendly amount for emails/UI: 59900 -> "R599.00". */
export function formatZar(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

/** Add whole years/months to an ISO date, returned as ISO8601. */
export function addPeriod(from: Date, period: 'year' | 'month', count = 1): string {
  const d = new Date(from.getTime());
  if (period === 'year') d.setUTCFullYear(d.getUTCFullYear() + count);
  else d.setUTCMonth(d.getUTCMonth() + count);
  return d.toISOString();
}

/** A readable, collision-resistant Paystack reference. */
export function newReference(prefix = 'udo'): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// ── Paystack: initialize a hosted checkout ────────────────────────
export interface InitOptions {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface InitResult {
  ok: boolean;
  authorizationUrl?: string;
  reference?: string;
  error?: string;
}

export async function paystackInitialize(env: Env, o: InitOptions): Promise<InitResult> {
  if (!env.PAYSTACK_SECRET_KEY) return { ok: false, error: 'Payments are not configured yet.' };
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: o.email,
        amount: o.amountCents, // ZAR subunit = cents
        currency: o.currency || 'ZAR',
        reference: o.reference,
        callback_url: o.callbackUrl,
        metadata: o.metadata || {},
      }),
    });
    const json = await res.json<any>();
    if (!res.ok || !json?.status) {
      return { ok: false, error: json?.message || `Paystack error (${res.status})` };
    }
    return { ok: true, authorizationUrl: json.data?.authorization_url, reference: json.data?.reference };
  } catch (e) {
    console.error('paystackInitialize failed:', e);
    return { ok: false, error: 'Could not reach the payment provider. Please try again.' };
  }
}

// ── Paystack: verify a transaction (server-side truth) ────────────
export interface VerifyResult {
  ok: boolean;
  success: boolean;
  amountCents?: number;
  currency?: string;
  email?: string;
  channel?: string;
  paidAt?: string;
  metadata?: Record<string, any>;
  raw?: any;
  error?: string;
}

export async function paystackVerify(env: Env, reference: string): Promise<VerifyResult> {
  if (!env.PAYSTACK_SECRET_KEY) return { ok: false, success: false, error: 'Payments are not configured yet.' };
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });
    const json = await res.json<any>();
    if (!res.ok || !json?.status) return { ok: false, success: false, error: json?.message || 'Verification failed' };
    const d = json.data || {};
    return {
      ok: true,
      success: d.status === 'success',
      amountCents: d.amount,
      currency: d.currency,
      email: d.customer?.email,
      channel: d.channel,
      paidAt: d.paid_at || d.paidAt,
      metadata: d.metadata || {},
      raw: d,
    };
  } catch (e) {
    console.error('paystackVerify failed:', e);
    return { ok: false, success: false, error: 'Could not verify the payment.' };
  }
}

// ── Paystack: webhook signature (HMAC SHA-512 of the RAW body) ────
// Paystack signs with your SECRET key. Constant-time compare.
export async function verifyPaystackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const bytes = new Uint8Array(sig);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return timingSafeEqual(hex, signature.trim().toLowerCase());
  } catch (e) {
    console.error('verifyPaystackSignature failed:', e);
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Access decision (the single place that decides "can this centre work?") ──
export interface AccessState {
  allowed: boolean;
  reason: 'active' | 'trialing' | 'grace' | 'expired' | 'suspended' | 'no_subscription';
  paidUntil?: string | null;
  trialEndsAt?: string | null;
  daysRemaining?: number;
}

export function evaluateAccess(sub: {
  status?: string;
  paid_until?: string | null;
  trial_ends_at?: string | null;
  grace_days?: number;
} | null, now = new Date()): AccessState {
  if (!sub) return { allowed: true, reason: 'no_subscription' }; // fail-open: never lock out an un-migrated centre
  if (sub.status === 'suspended' || sub.status === 'cancelled') {
    return { allowed: false, reason: 'suspended', paidUntil: sub.paid_until };
  }

  const day = 86_400_000;

  if (sub.paid_until) {
    const until = new Date(sub.paid_until).getTime();
    if (!Number.isNaN(until)) {
      if (until > now.getTime()) {
        return {
          allowed: true,
          reason: 'active',
          paidUntil: sub.paid_until,
          daysRemaining: Math.ceil((until - now.getTime()) / day),
        };
      }
      const graceEnd = until + (sub.grace_days ?? 14) * day;
      if (graceEnd > now.getTime()) {
        return {
          allowed: true,
          reason: 'grace',
          paidUntil: sub.paid_until,
          daysRemaining: Math.ceil((graceEnd - now.getTime()) / day),
        };
      }
      return { allowed: false, reason: 'expired', paidUntil: sub.paid_until };
    }
  }

  if (sub.trial_ends_at) {
    const t = new Date(sub.trial_ends_at).getTime();
    if (!Number.isNaN(t) && t > now.getTime()) {
      return {
        allowed: true,
        reason: 'trialing',
        trialEndsAt: sub.trial_ends_at,
        daysRemaining: Math.ceil((t - now.getTime()) / day),
      };
    }
    return { allowed: false, reason: 'expired', trialEndsAt: sub.trial_ends_at };
  }

  // status active but no dates recorded — treat as active (grandfathered)
  return { allowed: sub.status === 'active', reason: sub.status === 'active' ? 'active' : 'expired' };
}
