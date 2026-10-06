# Report Engine Architecture (six source formats → one engine)

## 1. Per-report analysis

| # | Report | Data required | Source of truth | Verified today | Unresolved | Deterministic calcs | Class |
|---|--------|---------------|-----------------|----------------|------------|---------------------|-------|
| 1 | Monthly front cover (A4 portrait) | Centre identity, capacity cert/SLA/claimed, income-class counts, admissions/discharges, trained/volunteers, disabilities, employed, ICT stats | `settings` + `centres` + children aggregates + cover-only fields | Identity fields (imported); M/F counts | Capacity (DR-27), admissions (DR-10), ICT (no schema), trained/employed (DR-11) | counts from children rows; BLANK ≠ 0 policy | Statutory |
| 2 | Summary of children (A4 landscape) | Names/file refs, DOB/ID, age Y/M, M/F, B/W/C/A, disability + description, income classes, amounts, admissions/exits, days | `children` + attendance totals + ages-at-period | Names, IDs raw, gender, race, disability, income class, days (staged) | Ages (DR-07), amounts/admissions cells BLANK, file refs absent | age from DOB+reference date; totals row | Statutory |
| 3 | Attendance register Annexure A (A4 landscape) | Names, age Y/M, slots 1–22 marks, totals, sign-off | `attendance_records` (once mapped) | Totals arithmetic (576/12/28) | Slot→date mapping (DR-03) | P-count per child; totals | Statutory |
| 4 | Summary of staff (A4 landscape) | Names, IDs, M/F, B/W/C/A, disability, designation, training, subsidised, gross salary, compiler sign-off | `staff` (+ salary measure) | All except salary | Salary basis (DR-09); row 3 training (DR-24) | gross sum (printed vs calculated) | Statutory |
| 5 | Monthly income & expenditure (A4 portrait) | Income by source, expenses by category, totals | `ledger_entries` (period=month) | Source values transcribed + arithmetic verified | Ledger not yet approved (DR-06/Q6); year (DR-20) | totals, shortfall (−768.33) | Management / submission |
| 6 | Quarterly expenditure (A4 portrait) | Income, category rows with %/allocated/GDE/other/invoice, bank charges, totals, balances, authorisations | `ledger_entries` + `budget_allocations` + `bank_balances` | All source values + reconciliation | Year (DR-08), row-6 outlier (DR-13) | allocations (= % × funding received), totals, movement | Statutory |

## 2. ONE engine (not six hard-coded templates)

```
verified DaycareOS data (centre-scoped queries)
        ↓
canonical report data model   ReportDocument { meta, period, provenance[], sections[] }
                              sections = labelValue | table(colDefs, groupedHead, rows) | signatureBlock
                              cell value types: value | null(UNKNOWN/BLANK) | 'dash' | printed_total marker
        ↓
validation layer              deterministic calcs in integer cents; cross-table invariants
                              (attendance totals tie; printed vs calculated both kept; blank never coerced)
                              → produces ValidationResult { ok, exceptions[] } — FAIL CLOSED on invariant break
        ↓
report template               registry: {family, version, orientation, grouped headers, column order,
                              sign-off blocks} — layout comes from the transcribed source structure,
                              data never from the template
        ↓
HTML                          one renderer; A4 CSS (@page portrait/landscape), no clipping budgets
                              enforced by column-width validation
        ↓
PDF                           browser print-to-PDF (zero new dependencies) — or jsPDF where programmatic
                              output is required (jsPDF 2.5.2 + jspdf-autotable 5.0.8 are ALREADY
                              manager/dependencies; no install needed)
```

**Rendering recommendation (production-safe, current stack):** render the canonical model to **HTML in the manager SPA** and export via **print-to-PDF** (exact A4 control, grouped headers and signature spaces as CSS, no new packages). Keep the existing jsPDF path only as an automation fallback for bulk exports. **Do not** add server-side PDF libraries: the deployment target is Cloudflare Workers/Pages, which cannot run headless Chrome or native PDF toolkits without a third-party service. **Reproducibility** comes from freezing the input: at finalisation, store `input_json` (the canonical model incl. provenance + exceptions) and the rendered HTML snapshot in the centre's private R2 (`documents/{centre}/reports/{runId}/`), so any period can be re-rendered after live data changes.

## 3. Report lifecycle (new, needed)
`report_runs(run_id, centre_id, family, period_id, state draft|reviewed|final, input_json, html_key, pdf_key, validation_json, created_by, created_at)` — final runs are immutable; re-rendering a final run reads `input_json`, never live tables. All six reports render in **draft** state only until the decision gate resolves their exceptions; nothing is signed or finalised (rule 10).

## 4. Engine defects to fix (verified in current `manager/src/pages/Reports.tsx`)
unknown→'P' default; today-only attendance fetch; age from `Date.now()`; days fallbacks (`|| 20`, `|| maxDays`); `s.salary` field mismatch; 2-parent column always blank; invented subsidy split (60/40) and fabricated narrative rows; hardcoded Lehakwe branding/filenames; string-based money arithmetic. All are render-layer fixes in the new template/validation pair — no schema dependency except the ledger for reports 5–6.
