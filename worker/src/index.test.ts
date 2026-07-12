import { describe, it, expect } from 'vitest';
import worker from './index';

// Minimal env for routing/middleware tests (these paths don't touch D1).
const env: any = { JWT_SECRET: 'test-secret', ALLOWED_ORIGIN: 'https://app.lehakwedaycare.co.za' };
const ctx: any = {};

function get(path: string) {
  return worker.fetch(new Request(`https://api.lehakwedaycare.co.za${path}`), env, ctx);
}

describe('worker routing & auth middleware', () => {
  it('GET /api/health is public and returns ok', async () => {
    const res = await get('/api/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.ok).toBe(true);
  });

  it('GET /api/public/qr/:token is public', async () => {
    const res = await get('/api/public/qr/some-token');
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data.url).toContain('some-token');
  });

  it('GET /api/children requires authentication', async () => {
    const res = await get('/api/children');
    expect(res.status).toBe(401);
  });

  it('returns 500 when JWT secret is not configured', async () => {
    const res = await worker.fetch(new Request('https://api.lehakwedaycare.co.za/api/health'), { ALLOWED_ORIGIN: '' } as any, ctx);
    expect(res.status).toBe(500);
  });
});
