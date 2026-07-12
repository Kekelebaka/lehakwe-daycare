import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt, hashPassword, verifyPassword, type JwtPayload } from './auth';

const SECRET = 'unit-test-secret-please-change';

function makePayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  const now = Math.floor(Date.now() / 1000);
  return { sub: 'staff-1', role: 'admin', email: 'a@example.com', name: 'Ada', iat: now, exp: now + 3600, ...overrides };
}

describe('password hashing (PBKDF2)', () => {
  it('verifies a correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('produces a unique salt per hash', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });
});

describe('JWT (HS256)', () => {
  it('round-trips a valid token', async () => {
    const token = await signJwt(makePayload(), SECRET);
    const verified = await verifyJwt(token, SECRET);
    expect(verified?.sub).toBe('staff-1');
    expect(verified?.role).toBe('admin');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt(makePayload(), SECRET);
    expect(await verifyJwt(token, 'a-different-secret')).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await signJwt(makePayload(), SECRET);
    const tampered = token.slice(0, -3) + (token.slice(-3) === 'aaa' ? 'bbb' : 'aaa');
    expect(await verifyJwt(tampered, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(makePayload({ iat: now - 7200, exp: now - 3600 }), SECRET);
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('rejects a malformed token', async () => {
    expect(await verifyJwt('not.a.jwt', SECRET)).toBeNull();
    expect(await verifyJwt('only-one-part', SECRET)).toBeNull();
  });
});
