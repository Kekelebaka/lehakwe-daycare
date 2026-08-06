import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { verifySupabaseToken } from './coordinator';

// Real ES256 keypair — we sign tokens exactly as Supabase does and serve the
// public half from a stubbed JWKS endpoint, so these tests exercise the actual
// cryptographic path rather than a mock of it.
let priv: CryptoKey;
let pubJwk: any;
const KID = 'test-kid-1';

const b64u = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64uStr = (s: string) => b64u(new TextEncoder().encode(s));

beforeAll(async () => {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  priv = kp.privateKey;
  pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  pubJwk.kid = KID;
  pubJwk.alg = 'ES256';
  pubJwk.use = 'sig';
  delete pubJwk.d;
});

async function makeToken(claims: Record<string, any>, opts: { kid?: string; alg?: string; badSig?: boolean } = {}) {
  const header = { alg: opts.alg || 'ES256', typ: 'JWT', kid: opts.kid || KID };
  const h = b64uStr(JSON.stringify(header));
  const p = b64uStr(JSON.stringify(claims));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, priv, new TextEncoder().encode(`${h}.${p}`),
  );
  let sigBytes = new Uint8Array(sig);
  if (opts.badSig) sigBytes = new Uint8Array(sigBytes.map((b, i) => (i === 0 ? b ^ 0xff : b)));
  return `${h}.${p}.${b64u(sigBytes)}`;
}

let urlCounter = 0;
function envFor() {
  // A distinct URL per test keeps the module-level JWKS cache from bleeding between cases.
  const SUPABASE_URL = `https://proj${urlCounter++}.supabase.co`;
  return { SUPABASE_URL } as any;
}

function stubJwks(keys: any[]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys }), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

const validClaims = (env: any, over: Record<string, any> = {}) => ({
  sub: 'user-uuid-123',
  email: 'coordinator@ubuntutown.co.za',
  iss: `${env.SUPABASE_URL}/auth/v1`,
  exp: Math.floor(Date.now() / 1000) + 3600,
  user_metadata: { full_name: 'Naledi Coordinator' },
  ...over,
});

describe('verifySupabaseToken — the coordinator authentication boundary', () => {
  it('accepts a properly signed, unexpired token from the right project', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    const id = await verifySupabaseToken(env, await makeToken(validClaims(env)));
    expect(id).not.toBeNull();
    expect(id!.sub).toBe('user-uuid-123');
    expect(id!.email).toBe('coordinator@ubuntutown.co.za');
    expect(id!.name).toBe('Naledi Coordinator');
  });

  it('rejects a tampered signature', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    expect(await verifySupabaseToken(env, await makeToken(validClaims(env), { badSig: true }))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    const t = await makeToken(validClaims(env, { exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(await verifySupabaseToken(env, t)).toBeNull();
  });

  it('rejects a token minted by a different Supabase project', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    const t = await makeToken(validClaims(env, { iss: 'https://someone-else.supabase.co/auth/v1' }));
    expect(await verifySupabaseToken(env, t)).toBeNull();
  });

  it('rejects an unknown signing key (kid not in JWKS)', async () => {
    const env = envFor(); stubJwks([{ ...pubJwk, kid: 'a-different-kid' }]);
    expect(await verifySupabaseToken(env, await makeToken(validClaims(env)))).toBeNull();
  });

  it('refuses the "none" algorithm even with a well-formed payload', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    const h = b64uStr(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const p = b64uStr(JSON.stringify(validClaims(env)));
    expect(await verifySupabaseToken(env, `${h}.${p}.`)).toBeNull();
  });

  it('refuses HS256 unless a shared secret is explicitly configured', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    // Signed with our EC key but *claiming* HS256 — must not be accepted.
    expect(await verifySupabaseToken(env, await makeToken(validClaims(env), { alg: 'HS256' }))).toBeNull();
  });

  it('rejects a token with no email or no subject', async () => {
    const env1 = envFor(); stubJwks([pubJwk]);
    expect(await verifySupabaseToken(env1, await makeToken(validClaims(env1, { email: undefined })))).toBeNull();
    const env2 = envFor(); stubJwks([pubJwk]);
    expect(await verifySupabaseToken(env2, await makeToken(validClaims(env2, { sub: undefined })))).toBeNull();
  });

  it('rejects malformed input and missing configuration', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    expect(await verifySupabaseToken(env, 'not-a-jwt')).toBeNull();
    expect(await verifySupabaseToken(env, '')).toBeNull();
    expect(await verifySupabaseToken({} as any, await makeToken(validClaims(env)))).toBeNull();
  });

  it('normalises the email to lower case', async () => {
    const env = envFor(); stubJwks([pubJwk]);
    const id = await verifySupabaseToken(env, await makeToken(validClaims(env, { email: 'Naledi@UbuntuTown.CO.ZA' })));
    expect(id!.email).toBe('naledi@ubuntutown.co.za');
  });
});
