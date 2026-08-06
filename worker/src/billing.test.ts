import { describe, it, expect } from 'vitest';
import { evaluateAccess, verifyPaystackSignature, formatZar, addPeriod, newReference } from './billing';
import { originAllowed } from './index';

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;

describe('evaluateAccess — who may use the product', () => {
  it('fails OPEN when a centre has no subscription row (never lock out an un-migrated centre)', () => {
    const a = evaluateAccess(null);
    expect(a.allowed).toBe(true);
    expect(a.reason).toBe('no_subscription');
  });

  it('allows a centre paid into the future', () => {
    const a = evaluateAccess({ status: 'active', paid_until: iso(30 * DAY) });
    expect(a.allowed).toBe(true);
    expect(a.reason).toBe('active');
    expect(a.daysRemaining).toBeGreaterThan(28);
  });

  it('allows a lapsed centre while inside its grace period', () => {
    const a = evaluateAccess({ status: 'active', paid_until: iso(-3 * DAY), grace_days: 14 });
    expect(a.allowed).toBe(true);
    expect(a.reason).toBe('grace');
  });

  it('blocks once the grace period is exhausted', () => {
    const a = evaluateAccess({ status: 'active', paid_until: iso(-30 * DAY), grace_days: 14 });
    expect(a.allowed).toBe(false);
    expect(a.reason).toBe('expired');
  });

  it('respects a custom grace window', () => {
    const sub = { status: 'active', paid_until: iso(-10 * DAY), grace_days: 3 };
    expect(evaluateAccess(sub).allowed).toBe(false);
    expect(evaluateAccess({ ...sub, grace_days: 30 }).allowed).toBe(true);
  });

  it('allows an active trial and blocks an expired one', () => {
    expect(evaluateAccess({ status: 'trialing', trial_ends_at: iso(5 * DAY) }).allowed).toBe(true);
    expect(evaluateAccess({ status: 'trialing', trial_ends_at: iso(-1 * DAY) }).allowed).toBe(false);
  });

  it('always blocks suspended and cancelled centres', () => {
    expect(evaluateAccess({ status: 'suspended', paid_until: iso(365 * DAY) }).allowed).toBe(false);
    expect(evaluateAccess({ status: 'cancelled', paid_until: iso(365 * DAY) }).allowed).toBe(false);
  });

  it('grandfathers an active centre with no dates recorded', () => {
    expect(evaluateAccess({ status: 'active' }).allowed).toBe(true);
  });

  it('prefers paid_until over a stale trial date', () => {
    const a = evaluateAccess({ status: 'active', paid_until: iso(60 * DAY), trial_ends_at: iso(-90 * DAY) });
    expect(a.allowed).toBe(true);
    expect(a.reason).toBe('active');
  });
});

describe('verifyPaystackSignature', () => {
  const secret = 'sk_test_pretend_secret';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'udo_abc' } });

  // Reference HMAC-SHA512 hex, computed the same way Paystack does.
  async function sign(payload: string, key: string) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(payload));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  it('accepts a correctly signed payload', async () => {
    expect(await verifyPaystackSignature(body, await sign(body, secret), secret)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const good = await sign(body, secret);
    const tampered = body.replace('udo_abc', 'udo_xyz');
    expect(await verifyPaystackSignature(tampered, good, secret)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    expect(await verifyPaystackSignature(body, await sign(body, 'wrong'), secret)).toBe(false);
  });

  it('rejects empty signature or missing secret', async () => {
    expect(await verifyPaystackSignature(body, '', secret)).toBe(false);
    expect(await verifyPaystackSignature(body, await sign(body, secret), '')).toBe(false);
  });
});

describe('originAllowed — wildcard tenant CORS', () => {
  const patterns = ['https://daycareos.ubuntutown.co.za', 'https://*.daycareos.ubuntutown.co.za'];

  it('allows the apex and any tenant subdomain', () => {
    expect(originAllowed('https://daycareos.ubuntutown.co.za', patterns)).toBe(true);
    expect(originAllowed('https://lehakwe.daycareos.ubuntutown.co.za', patterns)).toBe(true);
    expect(originAllowed('https://little-stars-2.daycareos.ubuntutown.co.za', patterns)).toBe(true);
  });

  it('rejects look-alike and foreign origins', () => {
    expect(originAllowed('https://daycareos.ubuntutown.co.za.evil.com', patterns)).toBe(false);
    expect(originAllowed('https://evil.com', patterns)).toBe(false);
    expect(originAllowed('http://lehakwe.daycareos.ubuntutown.co.za', patterns)).toBe(false); // scheme matters
  });

  it('does not let a wildcard span dots (no nested-subdomain smuggling)', () => {
    expect(originAllowed('https://a.b.daycareos.ubuntutown.co.za', patterns)).toBe(false);
  });
});

describe('money + period helpers', () => {
  it('formats ZAR cents', () => {
    expect(formatZar(59900)).toBe('R599.00');
    expect(formatZar(25000)).toBe('R250.00');
    expect(formatZar(9900)).toBe('R99.00');
  });

  it('adds a year and a month', () => {
    const from = new Date('2026-08-06T00:00:00.000Z');
    expect(addPeriod(from, 'year')).toBe('2027-08-06T00:00:00.000Z');
    expect(addPeriod(from, 'month')).toBe('2026-09-06T00:00:00.000Z');
  });

  it('mints unique references', () => {
    const refs = new Set(Array.from({ length: 200 }, () => newReference()));
    expect(refs.size).toBe(200);
  });
});
