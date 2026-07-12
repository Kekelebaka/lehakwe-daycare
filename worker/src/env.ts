import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';
import type { JwtPayload } from './auth';

export interface Env {
  DB: D1Database;
  EMAIL_STORE: R2Bucket;
  MEDIA: R2Bucket;            // Phase 2: child photos / media
  FORWARD_EMAILS: string;
  AUTO_REPLY_ENABLED: string;
  SENDING_DOMAIN: string;
  ALLOWED_ORIGIN: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;    // optional: enables outbound reply email
  TURNSTILE_SECRET?: string;  // optional: enables login CAPTCHA verification
  RATE_LIMIT?: KVNamespace;   // optional: enables login rate-limiting
  AI: any;
}

// Per-request context values set by middleware.
export type Variables = { identity: JwtPayload | null };

// The Hono generic used across the app and route modules.
export type AppEnv = { Bindings: Env; Variables: Variables };
