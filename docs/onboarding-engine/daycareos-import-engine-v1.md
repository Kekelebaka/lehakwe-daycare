# DaycareOS Centre Import Engine v1 — Design
Reference implementation: Sally's Day Care (batch `sallys-import-2026-10-06-01`, 28 children / 4 staff / 588 staged attendance slots / 2 finance summaries).
Target scale: 1,000 centres. Principles: correctness → provenance → privacy → reversibility → repeatability → scale.

## 1. Pipeline
```
INGEST → EXTRACT → NORMALISE → VALIDATE → EXCEPTION REVIEW → HUMAN CONFIRMATION → IMPORT → VERIFY → ACTIVATE
```
| Stage | Input → Output | Rules |
|---|---|---|
| INGEST | PDFs/spreadsheets/forms/registers → stored source artifacts (private R2, `sources/{centre}/{batch}/`) | Raw evidence immutable; never overwritten; scanned pages indexed by page number |
| EXTRACT | artifacts → candidate values with (doc, page, row/cell) coordinates | Transcription or OCR; extractor confidence recorded; nothing discarded |
| NORMALISE | candidates → typed values (money→integer cents, dates→ISO, codes→enum + raw) | Raw string always kept beside normalised value; mapping table is versioned and explicit (e.g. B→african only where the app's own templates define it) |
| VALIDATE | typed values → validation results (clean / flagged / blocked) | Checksums, plausibility, cross-document totals (e.g. D2↔D3 tie), required-field policy; BLANK ≠ 0/No/Present |
| EXCEPTION REVIEW | flagged/blocked → decision register rows (GREEN/AMBER/RED) | Every exception: evidence, risk, proposed resolution, who must answer |
| HUMAN CONFIRMATION | register → answers (one consolidated gate per centre) | Answers recorded verbatim with who/when; no auto-resolution of AMBER/RED |
| IMPORT | confirmed rows → application records via the **app API** (zod-validated, tenant-stamped, audited) | Never direct DB writes; idempotent natural keys; per-entity batches; resumable |
| VERIFY | imported state vs manifest | Read-back through the app API; counts + spot fields + duplicate scan; drift = STOP |
| ACTIVATE | verified state → activation gate | FAIL CLOSED; activation is a separate human-authorised step |

## 2. Provenance contract (every imported value must answer "where did this come from?")
Per record: `source_doc, source_page, source_row, source_cell, raw_value, normalised_value, validation_status, exception_flags[], import_batch, extracted_at, imported_at, record_id`.
Storage: `import_batches` + `import_items` (proposed below) as the system of record; a human-readable manifest mirrored into the centre's private document store (as done for Sally's: Import Review doc `7272012d…`); raw source artifacts in private R2. Raw evidence is never destroyed.

## 3. Import mechanics
- **Natural keys:** child = `(centre_id, lower(full_name), id_number|date_of_birth)`; staff = `(centre_id, lower(full_name), id_number)`; attendance = `(centre_id, child_id, date)`; ledger = `(centre_id, period_id, source_doc, source_row)`. Unknown-key rows are blocked, never guessed.
- **Idempotent:** insert-if-absent; re-run ⇒ `created=0, skipped=N` (proven live for Sally's).
- **Transactional:** per-entity batch units; partial failure marks the batch `partial` and is safely re-runnable.
- **Tenant-scoped:** `centre_id` comes from the authenticated session; importer cannot write across centres; every request verified against `centre_domains`/JWT.
- **Auditable:** `audit_logs` per batch + counts; batch row holds who/when/counts/outcome.
- **Resumable:** progress derived from existing records (not cursors); interruption-safe.
- **Duplicate-safe:** unique checks in validation AND at write time; duplicates raise exceptions, not silent merges. Never dedupe distinct people who share DOB (Sally's rows 23/24 rule).

## 4. Proposed storage (UNAPPLIED — part of migration 020, requires approval)
```sql
CREATE TABLE import_batches (
  batch_id TEXT PRIMARY KEY, centre_id TEXT NOT NULL, source_kind TEXT, period_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','confirmed','imported','verified','partial','aborted')),
  created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  counts_json TEXT, notes TEXT, FOREIGN KEY (centre_id) REFERENCES centres(centre_id));
CREATE TABLE import_items (
  item_id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT,
  source_doc TEXT, source_page TEXT, source_row TEXT, source_cell TEXT,
  raw_value TEXT, normalised_value TEXT, validation_status TEXT NOT NULL,
  exception_flags TEXT, imported_at TEXT, FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id));
CREATE INDEX idx_import_items_batch ON import_items(batch_id, entity);
```

## 5. Interfaces
- CLI: `daycareos-import ingest|extract|validate|plan|apply|verify --centre <slug> --batch <id>` (operator-side; credentials via app login, never raw DB).
- App UI (later): centre-side "Legacy import" review screen listing `import_items` grouped by exception status with confirm/reject actions — this becomes the standard onboarding surface for the next 1,000 centres.
- Everything runs against the **application API**, so app-level validation, RBAC and tenant isolation are never bypassed.

## 6. Security & privacy (non-negotiables)
Children's PII stays in: app DB (tenant-scoped), private R2 (auth-gated, verified 200/401), and 0600 local workspace during processing. Never in Git, logs, fixtures, or error messages. Test fixtures are synthetic only. Uploads respect existing type/size validation (Sally's manifest went in as `text/plain` rather than weakening the allow-list).
