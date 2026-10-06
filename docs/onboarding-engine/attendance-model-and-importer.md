# Attendance — Model Analysis & Prepared Importer

## 1. Source structure (verified from transcription, D3)
- 28 children (rows 1–28, matching D2 order).
- Columns: Number | Surname & Initials | Age–Years | Age–Months | slots **1..22** | Total Days Attended.
- Slots 1–21 carry marks for every child (588 populated slots = 28 × 21).
- Marks: 576 P, 12 A (A-slots per child: row 1 → 8,14; row 14 → 6,12,19; row 15 → 18,19; row 20 → 21; row 26 → 16; row 28 → 3,4,5).
- Slot 22 is BLANK for every child (28 blank slots).
- Printed totals per child = 21 − (A-slots) and tie exactly to D2 "Total Days Attended" (sum 576).
- Period: September 2026 (from D1 cover). Column semantics (calendar dates vs operating-day numbers) are **unresolved** (register DR-03).

## 2. Current DaycareOS schema (verified)
`attendance_records(id, child_id, date TEXT NOT NULL, check_in_time, check_out_time, status present|absent|late|excused, absence_reason, recorded_by, synced, created_at, centre_id)`.

- **No slot/sequence concept; `date` is mandatory.** A historical import therefore cannot be expressed without dates.
- The report engine additionally fetches only "today's" attendance and defaults missing marks to 'P' (defect — never acceptable).
- **Conclusion:** DaycareOS does not currently support historical attendance imports correctly. Loading slots requires an explicit, confirmed slot→date mapping. Nothing was imported and nothing was invented.

## 3. Deterministic mapping method (designed)
Inputs: (a) `attendance-slot-map.json` — a centre-confirmed, versioned list mapping each slot number to a calendar date (or explicitly `null` for unused slot 22); (b) the source slot marks (in the import manifest); (c) per-child printed totals.

Rules (strict):
1. Slot → date is taken ONLY from the confirmed map. No inference, no "first 21 days", no weekday assumption.
2. `P` → `status='present'`; `A` → `status='absent'`; **BLANK → no record at all** (a blank is not "present", not "absent", not zero).
3. Slot 22 stays unmapped unless the map explicitly assigns it (currently blank for all rows).
4. Closures/holidays: dates absent from the map simply produce no records; the report column stays blank and is excluded from denominators.
5. Validation before write: per child, count(P) must equal the printed total and count(A) must equal the listed A-slots; any mismatch aborts the batch.
6. Reference date for ages is a separate confirmed input (gate Q4) — ages are derived at render time, never stored from the source.

## 4. The ONE question that unlocks the import (DR-03 / gate Q2)
"For September 2026, do the numbered attendance columns 1–22 represent **operating-day numbers** (the 1st, 2nd … 22nd day the centre operated) or **calendar dates**? Please supply the mapping: slot number → date (e.g. slot 1 = 2026-09-01 … or slot 1 = 2026-09-02 if the 1st was closed). Slot 22 is blank in the source — confirm it should remain unmapped."

With that answer, the prepared importer loads all 576 P + 12 A marks unchanged and leaves 28 slots blank.

## 5. Prepared importer: `attendance_importer.py` (NOT executed)
Properties (by construction):
- **Idempotent / duplicate-safe:** natural key `(centre_id, child_id, date)`; every write is insert-if-absent; re-runs report `skipped`.
- **Transaction-safe:** writes in per-child batches (`db.batch` semantics); a failed batch is re-runnable and never partially counted as imported.
- **Tenant-scoped:** `centre_id` taken from the authenticated session (never from input); all reads/writes filtered by it.
- **Auditable:** one `audit_logs` entry per batch plus per-child counts.
- **Provenance-preserving:** every row records `import_batch`, source doc/row, and the slot number; the manifest is the system of record for raw marks.
- **Resumable:** progress is derived from existing rows (not a cursor file); interruption at any point is safe.
- **Fail-closed:** refuses to run without a confirmed `attendance-slot-map.json`; refuses on any total mismatch, unknown mark, or mapped-slot/date duplication; never converts unknown to present.

Run mode (after gate Q2): `python3 attendance_importer.py --map attendance-slot-map.json --dry-run` then without `--dry-run`. Dry-run prints an insertion plan only.
