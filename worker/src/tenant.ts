// Phase 4 PR B — tenant resolution helpers.
// The centre for a request is resolved server-side (from the session JWT) by the
// auth middleware and stashed on the context. Route handlers read it via
// getCentreId(c) and MUST scope every tenant-table query by it. centre_id is never
// taken from the client (body/query) — only from the verified session.
import type { Context } from 'hono';
import type { AppEnv, Env } from './env';

// Centre #1 — Lehakwe. Fallback for legacy tokens issued before Phase 4 and for
// the single-tenant email/cron paths on the Lehakwe instance.
export const DEFAULT_CENTRE_ID = 'centre-lehakwe';

// The centre for the current authenticated request (set by middleware from the JWT).
export function getCentreId(c: Context<AppEnv>): string {
  return (c.get('centreId') as string | undefined) || DEFAULT_CENTRE_ID;
}

// Secondary defense-in-depth: map a request host to a registered centre, if any.
// Used to reject a session whose Origin belongs to a different centre.
export async function centreForHost(env: Env, host: string): Promise<string | null> {
  if (!host) return null;
  const row = await env.DB.prepare('SELECT centre_id FROM centre_domains WHERE host = ?')
    .bind(host).first<{ centre_id: string }>();
  return row?.centre_id ?? null;
}
