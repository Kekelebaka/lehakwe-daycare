# Contributing / Developer guide

This repo is a small monorepo of independent packages (each with its own `package.json`):

| Package    | What it is                          | Dev                | Build                 |
|------------|-------------------------------------|--------------------|-----------------------|
| `worker/`  | Cloudflare Worker — API + email     | `npm run dev`      | `wrangler deploy`     |
| `manager/` | React PWA (app.lehakwedaycare.co.za)| `npm run dev`      | `npm run build`       |
| `inbox/`   | React PWA (staff email inbox)       | `npm run dev`      | `npm run build`       |
| `db/`      | D1 schema + migrations              | —                  | `wrangler d1 execute` |

## Before opening / merging a PR

Run these locally (CI runs the same):

```bash
# worker
cd worker && npm install && npx tsc --noEmit && npm test

# manager
cd manager && npm ci && npm run build

# inbox
cd inbox && npm ci && npm run build
```

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`:
- **worker** — `tsc --noEmit` + Vitest unit tests
- **manager / inbox** — typecheck + Vite build
- **lint** — Biome (informational / non-blocking while we tighten rules across Phase 1)

## Conventions

- All API inputs validated (zod) and all data access goes through the tenant-scoped
  repository layer — no raw `env.DB` calls inside route handlers.
- Server enforces authentication **and** authorization (roles). Never trust the client for access.
- Secrets are set with `wrangler secret put` and never committed.

## Deploy

See each PR description for migration + deploy steps. Nothing auto-deploys; deploys are manual
(and should follow a green CI run + preview check).
