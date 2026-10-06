# Security & Privacy Review — Sally's migration path (focused)
Date 2026-10-06 · Scope: the legacy-import path (workspace files, app API usage, R2 document store, Git, backups, logs).

## Verified good
| Area | Finding | Evidence |
|---|---|---|
| Tenant isolation (app layer) | `centre_id` is taken only from the verified JWT; Origin-vs-session mismatch rejected; all route queries scoped by `centre_id` | `worker/src/index.ts`, `tenant.ts` (code read); importer test "tenant crossover rejected" PASS |
| Authentication | All mutating routes require session/Bearer auth; admin ops behind `requiresAdmin`; unauthenticated document fetch rejected | Live probes: `GET /api/documents/{id}/file` w/o token → 401, with token → 200 |
| R2 / document privacy | Uploads land under `documents/{centreId}/…`; streamed only through authenticated, centre-scoped endpoint with `Cache-Control: private` | Live probe (200/401 pair); manifest `7272012d…` verified |
| API exposure | Public surface limited to `/api/public/*` (signup rate-limited 5/h/IP, optional Turnstile; token-gated parent portal), `/api/health`, `/api/auth/*`, `/api/parent/*`, `/api/coordinator/*` | `worker/src/index.ts` middleware |
| Validation not weakened | JSON manifest uploaded as `text/plain` (an accepted type) instead of loosening the upload allow-list | Upload error first ("Allowed: PDF, image, Word or text"), then success as text/plain |
| Git hygiene | No raw child IDs/names/phones in repo docs or git history; contacts masked; no secrets (names of env vars only) | grep scans over `docs/` and rev-list blobs: zero 13-digit hits; one raw identifier fragment found in a register draft on 2026-10-06 and **removed before publishing** |
| Logs / tool output | Terminal outputs contain counts, row numbers, masked identifiers only; scripts print aggregates | Session transcript review |
| Test fixtures | Importer tests use synthetic names/IDs only (clearly labelled SYNTHETIC) | `import-engine/test_engine.py` |
| App audit trail | `audit_logs` rows for children/staff/settings/documents writes by the steward batch | Live read (35 entries incl. document + creates) |
| Error messages | API errors generic ("Unauthorized", "Endpoint not found"); no stack/PII leakage observed | Live probes |

## Findings requiring action (this review's changes are marked DONE)
1. **DONE — local file permissions:** `session.json` (contains steward token+password), `source-data.json`, `import-manifest.*` were group/world-readable (664) and the workspace dir was 775. Tightened to 600/700.
2. **OPEN — backup retention:** `bak20261006_*` tables live in the same D1 (same trust boundary, consistent with the existing `bakYYYYMMDD_*` convention) and contain pre-import state including other centres' children. Decide retention/cleanup policy (owner: platform ops). Not urgent; D1 is private to the account.
3. **OPEN — interim steward credentials:** the steward account password exists only in the 600 workspace file and the account is operator-controlled. On ownership transfer (DR-02), rotate/retire both.
4. **OPEN — Cloudflare OAuth session expired:** DB-level (D1 API) verification is currently unavailable until an interactive `wrangler login` (DR-28). No security impact; app-level verification remains available. Note: the OAuth refresh token could not be renewed non-interactively.
5. **OPEN (product-level, pre-existing):** `POST /api/public/signup` returns a session token in the response body (used legitimately by our importer); manager app uses cookies. Acceptable but worth hardening for self-serve scale. Also `public/child/:token` portal tokens are long-lived unless expiry set — review at engine hardening.
6. **NOTE — PII minimisation going forward:** register/report documents must keep identifiers masked; raw values live only in the app DB + private R2 + 600 workspace. Enforced by the import-engine provenance contract (`raw_value` never leaves the private stores).

## Conclusion
The migration path did not weaken any security control; children's data is confined to tenant-scoped stores with authenticated access, and the one accidental raw identifier in a draft doc was caught by scan and removed before publishing. Items 2–5 are operational hardening, not blockers for the decision gate.
