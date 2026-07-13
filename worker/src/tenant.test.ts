// @ts-nocheck — uses Node builtins (node:sqlite/fs/url/module) + import.meta.url that
// aren't in the Workers tsconfig types. Vitest transpiles via esbuild (no type-check);
// deploy builds never include test files. Runtime behaviour is asserted by the tests.
// Phase 4 PR B — two-centre isolation harness.
// Spins up an in-memory SQLite (node:sqlite) behind a minimal D1 shim, applies the
// real schema + migrations, seeds two centres (A and B), then drives REAL requests
// through worker.fetch and asserts that a session for centre A can never read or
// mutate centre B's data — and vice-versa. This is the release gate for tenancy.
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import worker from './index';
import { signJwt, type JwtPayload } from './auth';

const SECRET = 'tenant-test-secret';

// node:sqlite is a Node builtin Vite won't resolve at transform time — load it at runtime.
// It requires Node >= 22.5; if unavailable, the suite skips instead of failing the run.
const nodeRequire = createRequire(import.meta.url);
let DatabaseSync: any = null;
let hasSqlite = true;
try { ({ DatabaseSync } = nodeRequire('node:sqlite')); } catch { hasSqlite = false; }
const suite = hasSqlite ? describe : describe.skip;

// ── Minimal D1 shim over node:sqlite ────────────────────────────
function makeD1(sqlite: any) {
  const coerce = (v: any) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  function bound(sql: string, args: any[]): any {
    return {
      bind: (...a: any[]) => bound(sql, a.map(coerce)),
      first: async () => { const row = sqlite.prepare(sql).get(...args); return row === undefined ? null : row; },
      all: async () => ({ results: sqlite.prepare(sql).all(...args), success: true, meta: {} }),
      run: async () => { const i = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; },
    };
  }
  return {
    prepare: (sql: string) => bound(sql, []),
    batch: async (stmts: any[]) => { const out: any[] = []; for (const s of stmts) out.push(await s.run()); return out; },
    exec: (sql: string) => sqlite.exec(sql),
  };
}

let sqlite: any;
let env: any;
const ctx: any = { waitUntil() {} };

const MEDIA = { get: async () => ({ body: 'x', httpMetadata: { contentType: 'image/jpeg' } }), put: async () => {}, delete: async () => {} };

function seedCentre(x: string) {
  const cid = `centre-${x}`;
  const run = (sql: string, ...a: any[]) => sqlite.prepare(sql).run(...a);
  run("INSERT INTO centres (centre_id, slug, name, status, plan, mode) VALUES (?, ?, ?, 'active', 'self_service', 'pooled')", cid, x, `Centre ${x.toUpperCase()}`);
  run("INSERT INTO staff (staff_id, full_name, job_title, email, active, centre_id) VALUES (?, ?, 'Daycare Principal', ?, 1, ?)", `staff-${x}`, `Principal ${x}`, `${x}@test`, cid);
  run("INSERT INTO parents (parent_id, full_name, email, centre_id) VALUES (?, ?, ?, ?)", `parent-${x}`, `Parent ${x}`, `parent-${x}@test`, cid);
  run("INSERT INTO children (child_id, full_name, date_of_birth, age_group, status, parent_id, centre_id) VALUES (?, ?, '2022-04-01', 'Toddlers', 'active', ?, ?)", `child-${x}`, `Child ${x}`, `parent-${x}`, cid);
  run("INSERT INTO fee_records (fee_id, child_id, month, year, amount_due, amount_paid, status, centre_id) VALUES (?, ?, 7, 2026, 1000, 0, 'pending', ?)", `fee-${x}`, `child-${x}`, cid);
  run("INSERT INTO media (media_id, child_id, r2_key, content_type, caption, uploaded_by, centre_id) VALUES (?, ?, ?, 'image/jpeg', 'hi', ?, ?)", `media-${x}`, `child-${x}`, `media/child-${x}/1.jpg`, `staff-${x}`, cid);
  run("INSERT INTO notices (notice_id, title, content, category, pinned, published, centre_id) VALUES (?, ?, 'body', 'general', 0, 1, ?)", `notice-${x}`, `Notice ${x}`, cid);
  run("INSERT INTO compliance_items (compliance_id, category, item_name, status, centre_id) VALUES (?, 'Registration', 'ECD registration certificate', 'complete', ?)", `comp-${x}`, cid);
  run("INSERT INTO funding_applications (application_id, title, status, created_by, centre_id) VALUES (?, ?, 'draft', ?, ?)", `app-${x}`, `Grant ${x}`, `staff-${x}`, cid);
  run("INSERT INTO message_threads (thread_id, child_id, parent_id, centre_id) VALUES (?, ?, ?, ?)", `thread-${x}`, `child-${x}`, `parent-${x}`, cid);
  run("INSERT INTO thread_messages (message_id, thread_id, sender_type, sender_id, sender_name, body, centre_id) VALUES (?, ?, 'staff', ?, 'Staff', 'hello', ?)", `msg-${x}`, `thread-${x}`, `staff-${x}`, cid);
}

async function token(sub: string, role: string, centre_id: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const p: JwtPayload = { sub, role, email: `${sub}@test`, name: sub, centre_id, iat: now, exp: now + 3600 };
  return signJwt(p, SECRET);
}

async function call(path: string, jwt: string, opts: { method?: string; body?: any; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers['Cookie'] = `${opts.cookie || 'lehakwe_session'}=${jwt}`;
  const res = await worker.fetch(
    new Request(`https://api.test${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined }),
    env, ctx,
  );
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON (e.g. image stream) */ }
  return { status: res.status, json };
}

let staffA: string, staffB: string, parentA: string;

suite('Phase 4 multi-tenant isolation (D1 shim)', () => {

beforeAll(async () => {
  sqlite = new DatabaseSync(':memory:');
  const dbDir = fileURLToPath(new URL('../../db', import.meta.url));
  sqlite.exec(readFileSync(join(dbDir, 'schema.sql'), 'utf8'));
  const migs = readdirSync(join(dbDir, 'migrations')).filter((f) => /^0\d\d_.*\.sql$/.test(f)).sort();
  for (const m of migs) { const n = parseInt(m.slice(0, 3)); if (n >= 2 && n <= 16) sqlite.exec(readFileSync(join(dbDir, 'migrations', m), 'utf8')); }
  seedCentre('a');
  seedCentre('b');
  // centre-lehakwe (centre #1) is seeded by migration 014; give it a child for the
  // legacy-token regression check below.
  sqlite.prepare("INSERT INTO children (child_id, full_name, status, centre_id) VALUES ('child-leh', 'Lehakwe Kid', 'active', 'centre-lehakwe')").run();
  env = { DB: makeD1(sqlite), JWT_SECRET: SECRET, ALLOWED_ORIGIN: 'https://app.test', SENDING_DOMAIN: 'test.co.za', MEDIA, AI: { run: async () => ({ response: 'stub' }) } };
  staffA = await token('staff-a', 'admin', 'centre-a');
  staffB = await token('staff-b', 'admin', 'centre-b');
  parentA = await token('parent-a', 'parent', 'centre-a');
});

const ids = (arr: any[], key: string) => (arr || []).map((r) => r[key]);

describe('Phase 4 tenant isolation — list endpoints are centre-scoped', () => {
  it('GET /api/children returns only the caller centre’s children', async () => {
    const a = await call('/api/children', staffA);
    expect(a.status).toBe(200);
    expect(ids(a.json.data, 'child_id')).toEqual(['child-a']);
    const b = await call('/api/children', staffB);
    expect(ids(b.json.data, 'child_id')).toEqual(['child-b']);
  });

  it('parents / staff / notices / compliance / funding are all scoped', async () => {
    expect(ids((await call('/api/parents', staffA)).json.data, 'parent_id')).toEqual(['parent-a']);
    expect(ids((await call('/api/staff', staffA)).json.data, 'staff_id')).toEqual(['staff-a']);
    expect(ids((await call('/api/notices', staffA)).json.data, 'notice_id')).toEqual(['notice-a']);
    expect(ids((await call('/api/compliance', staffA)).json.data, 'compliance_id')).toEqual(['comp-a']);
    expect(ids((await call('/api/funding/applications', staffA)).json.data, 'application_id')).toEqual(['app-a']);
    // and B sees only B
    expect(ids((await call('/api/funding/applications', staffB)).json.data, 'application_id')).toEqual(['app-b']);
  });

  it('GET /api/messages/threads only lists the caller centre’s children', async () => {
    const a = await call('/api/messages/threads', staffA);
    expect(ids(a.json.data, 'child_id')).toEqual(['child-a']);
  });
});

describe('Phase 4 tenant isolation — cross-centre access by guessed id is blocked', () => {
  it('cannot stream another centre’s media (404), but can stream its own (200)', async () => {
    const cross = await call('/api/media/media-b', staffA);
    expect(cross.status).toBe(404);
    const own = await worker.fetch(new Request('https://api.test/api/media/media-a', { headers: { Cookie: `lehakwe_session=${staffA}` } }), env, ctx);
    expect(own.status).toBe(200);
  });

  it('PUT on another centre’s child does not modify it', async () => {
    const res = await call('/api/children/child-b', staffA, { method: 'PUT', body: { full_name: 'HACKED' } });
    expect(res.status).toBe(200); // handler returns ok, but WHERE centre_id filters it out
    const b = await call('/api/children', staffB);
    expect(b.json.data.find((r: any) => r.child_id === 'child-b').full_name).toBe('Child b');
  });

  it('DELETE on another centre’s child does not delete it', async () => {
    await call('/api/children/child-b', staffA, { method: 'DELETE' });
    expect(ids((await call('/api/children', staffB)).json.data, 'child_id')).toEqual(['child-b']);
  });

  it('funding AI generate on another centre’s application → 404 (not found in caller centre)', async () => {
    const res = await call('/api/funding/applications/app-b/generate', staffA, { method: 'POST', body: { section: 'motivation' } });
    expect(res.status).toBe(404);
  });
});

describe('Phase 4 tenant isolation — settings are per-centre (composite PK)', () => {
  it('each centre keeps its own settings namespace', async () => {
    await call('/api/settings', staffA, { method: 'PUT', body: { settings: { daycare_name: 'Alpha Centre' } } });
    await call('/api/settings', staffB, { method: 'PUT', body: { settings: { daycare_name: 'Beta Centre' } } });
    expect((await call('/api/settings', staffA)).json.data.daycare_name).toBe('Alpha Centre');
    expect((await call('/api/settings', staffB)).json.data.daycare_name).toBe('Beta Centre');
  });
});

describe('Phase 4 tenant isolation — parent portal is centre-scoped', () => {
  it('parent A sees only their child; cannot open centre B’s child', async () => {
    const me = await call('/api/parent/me', parentA, { cookie: 'lehakwe_parent' });
    expect(me.status).toBe(200);
    expect(ids(me.json.data.children, 'child_id')).toEqual(['child-a']);
    const cross = await call('/api/parent/child/child-b', parentA, { cookie: 'lehakwe_parent' });
    expect(cross.status).toBe(404);
  });
});

describe('Phase 4 — Lehakwe regresses cleanly as centre #1', () => {
  it('a legacy token WITHOUT centre_id defaults to centre-lehakwe and sees only its data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = await signJwt({ sub: 'staff-leh', role: 'admin', email: 'l@test', name: 'Leh', iat: now, exp: now + 3600 }, SECRET);
    const res = await call('/api/children', legacy);
    expect(res.status).toBe(200);
    expect(ids(res.json.data, 'child_id')).toEqual(['child-leh']);
  });
});

describe('Phase 4 PR C — self-serve signup provisions an isolated, seeded centre', () => {
  async function signup(body: any) {
    const res = await worker.fetch(new Request('https://api.test/api/public/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env, ctx);
    return { status: res.status, json: await res.json() };
  }

  it('creates a centre + owner, seeds defaults, auto-logs-in, and is fully isolated', async () => {
    const res = await signup({ centre_name: 'Sunny Kids', owner_name: 'Owner One', owner_email: 'owner@sunny.test', password: 'password123', province: 'Gauteng' });
    expect(res.status).toBe(200);
    expect(res.json.data.slug).toBe('sunny-kids');
    expect(String(res.json.data.centre_id)).toMatch(/^centre-/);
    expect(res.json.data.subdomain).toBe('sunny-kids.daycareos.ubuntutown.co.za');
    const tok = res.json.data.token;

    // Seeded defaults present for the new centre.
    expect((await call('/api/compliance', tok)).json.data.length).toBe(11);
    expect((await call('/api/fees/schedules', tok)).json.data.length).toBe(3);
    // Empty of operational data AND isolated from centres A/B.
    expect((await call('/api/children', tok)).json.data).toEqual([]);
    expect((await call('/api/parents', tok)).json.data).toEqual([]);
    // Registry reflects a trialing tenant.
    const centre = await call('/api/centre', tok);
    expect(centre.json.data.status).toBe('trialing');
    expect(centre.json.data.slug).toBe('sunny-kids');
  });

  it('gives a second centre with the same name a distinct slug', async () => {
    const res = await signup({ centre_name: 'Sunny Kids', owner_name: 'Owner Two', owner_email: 'owner2@sunny.test', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.json.data.slug).toBe('sunny-kids-2');
  });

  it('setup-complete flips the centre to active', async () => {
    const res = await signup({ centre_name: 'Bright Start', owner_name: 'Owner Three', owner_email: 'owner3@bright.test', password: 'password123' });
    const tok = res.json.data.token;
    expect((await call('/api/centre', tok)).json.data.status).toBe('trialing');
    const done = await call('/api/centre/setup-complete', tok, { method: 'POST' });
    expect(done.status).toBe(200);
    expect((await call('/api/centre', tok)).json.data.status).toBe('active');
  });

  it('rejects an invalid signup (short password)', async () => {
    const res = await signup({ centre_name: 'X Centre', owner_name: 'Y', owner_email: 'y@x.test', password: 'short' });
    expect(res.status).toBe(400);
  });
});

}); // suite
