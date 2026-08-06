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
  SMS_PROVIDER_URL?: string;  // optional: parent OTP delivery via SMS/WhatsApp gateway
  SMS_PROVIDER_KEY?: string;
  COOKIE_DOMAIN?: string;     // per-instance cookie domain (demo/tenants); defaults to Lehakwe
  DEMO_MODE?: string;         // 'true' on the demo instance: fixed parent OTP, no real sends
  AI: any;

  // ── Phase 5: paid self-serve SaaS ──
  PAYSTACK_SECRET_KEY?: string; // secret: enables checkout + webhook signature verification
  TENANT_BASE_DOMAIN?: string;  // apex for tenant subdomains, e.g. daycareos.ubuntutown.co.za
  PUBLIC_SITE_URL?: string;     // marketing site origin (checkout return page)
  BILLING_ENFORCED?: string;    // 'true' to hard-gate the API on subscription state
  SUPABASE_URL?: string;        // Ubuntu Town Supabase project (coordinator SSO)
  SUPABASE_JWT_SECRET?: string; // secret: verifies coordinator Supabase access tokens
}

// Per-request context values set by middleware.
// centreId is the tenant for the request, resolved from the session JWT (staff routes).
export type Variables = { identity: JwtPayload | null; centreId?: string };

// The Hono generic used across the app and route modules.
export type AppEnv = { Bindings: Env; Variables: Variables };
