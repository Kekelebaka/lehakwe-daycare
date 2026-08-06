// worker/src/coordinator.ts — Phase 6: Ubuntu Town coordinator identity.
//
// Coordinators are people from the Ubuntu Town side who onboard and support
// community creches on the sponsored Community plan. They do NOT get a password
// here: they sign in with their existing Ubuntu Town (Supabase) account.
//
// Trust model — two independent halves, both required:
//   1. AUTHENTICATION comes from Supabase. We verify their access token
//      cryptographically against the project's published JWKS. Supabase proves
//      "this is really person X".
//   2. AUTHORISATION comes from OUR database. A verified Supabase user is only
//      a coordinator if there is a matching active row in `coordinators`.
//      Being able to sign up to Ubuntu Town grants no power here.
//
// The Ubuntu Town project signs with ES256 (ECDSA P-256) via JWKS. We also
// accept legacy HS256 projects when SUPABASE_JWT_SECRET is configured.

import type { Env } from './env';

export interface SupabaseIdentity {
  sub: string;            // Supabase auth.users.id
  email: string;
  name?: string;
  raw: Record<string, any>;
}

// ── base64url ─────────────────────────────────────────────────────
function b64uToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64uToJson<T = any>(s: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64uToBytes(s)));
  } catch {
    return null;
  }
}

// ── JWKS cache (per isolate; keys rotate rarely) ──────────────────
let jwksCache: { url: string; fetchedAt: number; keys: any[] } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getJwks(supabaseUrl: string, kid: string): Promise<any | null> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
  const fresh = jwksCache && jwksCache.url === url && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;

  if (fresh) {
    const hit = jwksCache!.keys.find((k) => k.kid === kid);
    if (hit) return hit;
    // Unknown kid on a warm cache usually means the key just rotated — refetch.
  }

  try {
    const res = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } as any });
    if (!res.ok) return null;
    const body = await res.json<any>();
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    jwksCache = { url, fetchedAt: Date.now(), keys };
    return keys.find((k: any) => k.kid === kid) || null;
  } catch (e) {
    console.error('JWKS fetch failed:', e);
    return null;
  }
}

/**
 * Verify a Supabase access token. Returns the identity, or null for anything
 * we cannot fully prove — expired, wrong issuer, unknown key, bad signature.
 */
/** The Ubuntu Town Supabase project. Overridable per deployment; this is a
 *  public API origin, not a secret. */
export function supabaseUrl(env: { SUPABASE_URL?: string }): string {
  return (env.SUPABASE_URL || 'https://afiokbhuxfdacbsipoqk.supabase.co').replace(/\/$/, '');
}

export async function verifySupabaseToken(env: Env, token: string): Promise<SupabaseIdentity | null> {
  if (!token) return null;
  const projectUrl = supabaseUrl(env);

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  const header = b64uToJson<any>(h);
  const payload = b64uToJson<any>(p);
  if (!header || !payload) return null;

  const signed = new TextEncoder().encode(`${h}.${p}`);
  const sig = b64uToBytes(s);
  let valid = false;

  try {
    if (header.alg === 'ES256' || header.alg === 'RS256') {
      const jwk = await getJwks(projectUrl, header.kid);
      if (!jwk) return null;
      const algo =
        header.alg === 'ES256'
          ? { name: 'ECDSA', namedCurve: 'P-256' }
          : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
      const key = await crypto.subtle.importKey('jwk', jwk, algo as any, false, ['verify']);
      const verifyAlgo = header.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
      valid = await crypto.subtle.verify(verifyAlgo as any, key, sig, signed);
    } else if (header.alg === 'HS256' && env.SUPABASE_JWT_SECRET) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      valid = await crypto.subtle.verify('HMAC', key, sig, signed);
    } else {
      return null; // unsupported / "none" algorithm — never trust
    }
  } catch (e) {
    console.error('Supabase token verification error:', e);
    return null;
  }

  if (!valid) return null;

  // Claims
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;

  // Issuer must be this Supabase project.
  const expectedIss = `${projectUrl}/auth/v1`;
  if (payload.iss && payload.iss !== expectedIss) return null;

  const email = String(payload.email || payload.user_metadata?.email || '').toLowerCase();
  if (!payload.sub || !email) return null;

  return {
    sub: String(payload.sub),
    email,
    name: payload.user_metadata?.full_name || payload.user_metadata?.name || undefined,
    raw: payload,
  };
}

// ── Coordinator record lookup / linking ───────────────────────────
export interface CoordinatorRow {
  coordinator_id: string;
  supabase_user_id: string | null;
  email: string;
  full_name: string | null;
  town_id: string | null;
  role: string;
  active: number;
}

/**
 * Resolve a verified Supabase identity to a coordinator in OUR database.
 *
 * Matches on supabase_user_id first, then falls back to email so an admin can
 * pre-register a coordinator by email before they have ever signed in; on that
 * first sign-in we bind the Supabase user id permanently.
 *
 * Returns null when the person is not a registered, active coordinator — a
 * valid Ubuntu Town account is not by itself permission to manage centres.
 */
export async function resolveCoordinator(env: Env, id: SupabaseIdentity): Promise<CoordinatorRow | null> {
  let row = await env.DB.prepare(
    'SELECT coordinator_id, supabase_user_id, email, full_name, town_id, role, active FROM coordinators WHERE supabase_user_id = ?',
  ).bind(id.sub).first<CoordinatorRow>();

  if (!row) {
    row = await env.DB.prepare(
      'SELECT coordinator_id, supabase_user_id, email, full_name, town_id, role, active FROM coordinators WHERE lower(email) = ?',
    ).bind(id.email).first<CoordinatorRow>();

    if (row && !row.supabase_user_id) {
      await env.DB.prepare('UPDATE coordinators SET supabase_user_id = ? WHERE coordinator_id = ?')
        .bind(id.sub, row.coordinator_id).run();
      row.supabase_user_id = id.sub;
    }
  }

  if (!row || !row.active) return null;
  return row;
}

/** Does this coordinator have authority over this centre? */
export async function coordinatorOwnsCentre(env: Env, coordinatorId: string, centreId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS x FROM coordinator_centres WHERE coordinator_id = ? AND centre_id = ?',
  ).bind(coordinatorId, centreId).first();
  return !!row;
}
