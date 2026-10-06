# Sally's — Draft Delivery Record, Semantic Corrections & Live-Reporting Proposal
Date 2026-10-06 · Batch sallys-import-2026-10-06-01 · All draft artefacts labelled "DRAFT — FOR REVIEW"

## 1. Draft delivery (private, tenant-protected)
Delivered into Sally's existing private document store (app: https://app.lehakwedaycare.co.za → centre → Documents).
Verified: authenticated fetch 7/7 HTTP 200; unauthenticated 401; cross-centre fetch 404 (see §3).

| Document title (draft-labeled) | document_id | File |
|---|---|---|
| DRAFT 01 — Monthly Front Cover (Sep 2026) | 0a4adf25-7b98-4ed4-9c05-2de4184f19f0 | sallys-draft-01-front-cover-sep-2026-v1.pdf |
| DRAFT 02 — Summary of Children (Sep 2026) | addd7c2d-fb7a-48c1-baa6-7e589db1987d | sallys-draft-02-summary-of-children-sep-2026-v1.pdf |
| DRAFT 03 — Attendance Annexure A (Sep 2026, slots not dates) | fd48839a-eac6-4a61-9e82-89215401b6d8 | sallys-draft-03-attendance-annexure-a-sep-2026-v1.pdf |
| DRAFT 04 — Summary of Staff (Sep 2026) | 207c214d-b2af-478d-a83a-b16b88f3600a | sallys-draft-04-summary-of-staff-sep-2026-v1.pdf |
| DRAFT 05 — Income and Expenditure (Sep 2026) | aea47444-ffc9-4ccb-87f9-ab1237cee29e | sallys-draft-05-income-expenditure-sep-2026-v1.pdf |
| DRAFT 06 — Quarterly Expenditure (Jul–Sept, year unprinted) | b0cd3c87-2dc5-4d6e-babd-00e00cf34044 | sallys-draft-06-quarterly-expenditure-jul-sep-v1.pdf |
| DRAFT REVIEW PACK — all six + exception register | dee05510-7648-4cbf-8d61-ba7556278a59 | sallys-draft-review-pack-sep-2026-v1.pdf |

Local copies: /home/ubuntu/daycareos-sallys-prepopulation/drafts/ (private, 600/700).
Generation evidence: drafts/draft-manifest.json (acceptance numbers computed at render: 28/4, P=576 A=12 blank=28, gross R15,987, Sept R26,640.33, shortfall R768.33, quarterly 44,348.86+19,490.72=63,839.58 — all agree).
Rendering stack: jspdf@2.5.2 + jspdf-autotable@5.0.8, local install, package-lock.json retained. Structure matches the TRANSCRIBED layout (originals never supplied to this workspace), so exact visual match is not claimed.

## 2. Semantic mapping check (task 3)
- FINDING (VERIFIED): app `settings.municipality` held "Ekurhuleni North" — an education district (GDE), not a municipality. `Settings.tsx` labels this field "Municipality"; `Reports.tsx` claim generator (L182 label "Municipal District:") reads the same key — the app conflates the two concepts.
- DONE (additive, reversible): `settings.district = 'Ekurhuleni North'` written via the supported settings API and read back. Source value preserved separately; NOT presented as a verified municipality.
- PROPOSED CORRECTION (not executed): (a) relabel the Settings field to "Municipality" vs new "District (Education)" field; (b) report templates render "District: {district}" for the DSD cover (it prints a district) and "Municipal District" only from `municipality` once the true municipality is confirmed; (c) leave `municipality` value in place until Sally's confirms the municipality (do not invent "Ekurhuleni").

## 3. Historical rows vs application defaults (task 3)
- VERIFIED: children 28/28 carry `status='active'` — an application default that asserts current enrolment for what are historical Sep-2026 source rows (DR-19). Not changed (any change asserts another unconfirmed fact); flagged for the decision gate. Staff: 5 rows (4 imported + interim steward) all `active=1`; same caveat for the 4 historical staff rows.
- VERIFIED: no payroll records created — `basic_salary` sums to R0 across all staff, payslips 0, fee records 0 (rule 6/10 held).

## 4. Cross-centre isolation — VERIFIED by controlled test (task 4)
Method: created one clearly synthetic second centre (`Synthetic Isolation Test Centre`, centre-16af62a4-e3a8-4981-bdf4-c43f8a84d075, reserved-TLD owner email, credentials in 600 workspace file) and pointed its session at Sally's identifiers. No real centre's records were read.

| Probe (from synthetic centre's session) | Result |
|---|---|
| GET /children (list) | 200 — empty, none of Sally's 28 rows |
| GET /children/{sallys-child-id} | 404 — not readable across centres |
| GET /documents/{sallys-doc-id}/file | 404 — not readable across centres |
| GET /documents (list) | 200 — empty |
| GET /settings | 200 — synthetic centre's own; EMIS not Sally's |
| GET /fees/records | 200 — empty |

Plus earlier evidence: unauthenticated document fetch 401; code read confirms `centre_id` derives only from the verified JWT and every query is scoped (`WHERE centre_id = ?`).
REMAINING (staging only): cross-centre WRITE probe (attempting to modify another centre's record by ID) — deliberately not run against production because a failure of the control would damage live data; same scoping code path governs writes.

## 5. Interim owner & handover (no secrets exposed)
- The centre's account is an INTERIM PLATFORM-OPERATOR STEWARD (job title "Daycare Principal" → admin role), created at onboarding because the contact email is not verified authority (data rule 7). Its credentials live only in the 600 workspace file; no invitations were sent; no access was expanded in this step.
- Required handover process (needs the decision gate's Q1 + explicit approval): (1) Sally's names the authorised administrator and email; (2) that person's account is created/confirmed via the app's own admin reset-password flow (admin-reset route exists, `worker/src/routes/admin.ts`); (3) they sign in and verify; (4) the steward account is retired (deactivated + password rotated); (5) audit log entry recorded. No step may be skipped and none was performed.

## 6. Live reporting work — smallest complete proposal (task 6)
Principle: summary-report reproduction does NOT require a full accounting ledger. Smallest additions:
1. PERIOD + HISTORICAL FIELDS: `report_periods` (centre, kind month|quarter, start/end, printed year nullable) — resolves DR-08/20 once answered; reuse the existing unused `monthly_reports` table as an immutable JSON snapshot per generated report (input frozen at generation ⇒ reproducible after live data changes).
2. FINANCIAL SUMMARIES: one small `report_finance_summaries` table (period, category, amount_cents, funding_source, source_row, printed_value, flag) — summary rows only; no transactions, no double counting (feeds 05/06). Full ledger (finance-ledger-proposal.sql) remains optional and separate.
3. ATTENDANCE: slot→date map (one human answer, DR-03) + attendance import via the prepared importer; then Annexure A and totals derive from stored rows. Until then, the report must render source slots with the mapping caveat, as the draft does.
4. TEMPLATE SELECTION: report registry keyed by (document family, version); Sally's six formats = templates; other centres use the existing generators.
5. EXPORT/STATES: draft/reviewed/final states + "DRAFT — FOR REVIEW" banner until final; generated PDF stored via the existing documents API (already proven); snapshot JSON stored with it.

### Exact existing-generator defects (manager/src/pages/Reports.tsx) and proposed tested corrections
| Line | Defect | Correction |
|---|---|---|
| L798 | `row.push(att ? (att.status === 'present' ? 'P' : 'A') : 'P')` — missing attendance silently printed as P | Render '' (visibly missing) when no record exists for a mapped date; tri-state P/A/blank |
| L132 | `const today = new Date().toISOString()...` — attendance loaded for today only, so any historical month is empty → all-P | Load attendance for the report period range |
| L724, L794 | age computed from `Date.now()` at click time | Compute from verified DOB + explicit reference date (report period end); blank if DOB missing |
| L733 | `String(c.days_attended_current_month \|\| 20)` — fabricated 20-day fallback | Stored count only; else compute from attendance rows; else blank |
| L800 | `c.days_attended_current_month \|\| maxDays` — same fallback class | Same |
| L858 | `fmt(s.salary \|\| 0)` — reads nonexistent `salary` field → fabricated R0 | Read `basic_salary` only when the basis is confirmed; else blank, never 0 |
| L192 | `const subsidy = totalIncome * 0.6` — fabricated 60/40 split | Delete; require real allocation values or leave blank |
| L44,166,289,312,335,620,652,903 | hardcoded "LEHAKWE"/"Lehakwe" branding + filenames | settings-driven name/logo; filenames from centre slug + period |
| 05 generator | Monthly Income & Expenditure generator MISSING entirely | Add from the D5 template (structure captured in the draft) |
| general | no draft/final states; `monthly_reports` snapshot unused | States + snapshot-on-generate (see §6.1/6.2) |

Testing bar for the fix: unit tests with synthetic fixtures asserting (a) unknown attendance renders blank, never P; (b) ages stable for a fixed reference date; (c) totals never fabricate; (d) per-period regeneration reproduces the same PDF from the snapshot. Estimated effort: 3–5 dev days including tests; production change requires explicit approval (kept separate from this rendering authorisation).

## 7. What "deploy" did and did not do
- DID: re-rendered all drafts after fixes (report-01 undefined-cell bug), verified every page, uploaded the 7 PDFs to Sally's private document store (delivery above), wrote the district setting, ran the isolation test, recorded this proposal.
- DID NOT (awaiting explicit authorisation/decision gate): any production code change, schema migration, attendance import, payroll, subscription activation, ownership transfer, report finalisation.
