# Sally's Day Care Centre — Onboarding & Six-Report Investigation

Date: 2026-10-06 (SAST) · Phase: INVESTIGATION ONLY (no production centre created, no records imported, no migrations, no deploys)
Evidence labels: **VERIFIED** (checked against live system or code) · **INFERRED** (strongly implied, not directly observed) · **BLOCKED** (could not check — access/capability missing) · **NEEDS CONFIRMATION** (requires Sally's documents or a decision)

Contact data policy for this document: centre institutional identity (name, EMIS, address, district, ward) is recorded in full. Direct personal contact (mobile, email) is masked here because this repository is public; full values are held in the private brief and will be applied only at onboarding time. Children's and staff members' personal records are never stored in this repository.

---

## 1. Executive verdict

**Can Sally's be onboarded on the existing system today? Not at the target domain — one infrastructure piece is missing. The application code for multi-centre onboarding exists, is tested, and is running in production for other centres; what does not exist is the production API backend behind `app.daycareos.ubuntutown.co.za`.**

- **VERIFIED** — The multi-tenant DaycareOS platform (centre registry, tenant scoping, self-serve signup, paid signup, coordinator onboarding, seeding, subscriptions, RBAC) is fully implemented in `Kekelebaka/lehakwe-daycare` (default branch `main`) and is live in production on the Lehakwe instance (`api.lehakwedaycare.co.za` + `lehakwe-db`), which already contains 3 centres provisioned through the product's own flows.
- **VERIFIED** — `https://app.daycareos.ubuntutown.co.za` serves a deployed frontend (Pages project `ubuntu-tenant-manager`) whose API base is `https://api.daycareos.ubuntutown.co.za/api` (baked into the JS bundle). That API host is **dead**: DNS resolves to Cloudflare edge but no Worker custom domain, no zone route and no Worker serves it (TLS handshake failure on 443, HTTP 522 on 80). No Worker in the Cloudflare account has the SaaS tenant configuration (`TENANT_BASE_DOMAIN`, `APP_BASE_URL`, `BILLING_ENFORCED`).
- **VERIFIED** — Sally's Day Care Centre does not exist in either live database (name, EMIS `700900274`, and contact-email checks all return zero rows in `lehakwe-db` and `ubuntu-demo-db`).
- **BLOCKED (data)** — The six source PDFs are not present anywhere in the workspace (full filesystem search). Their layouts could not be verified; every layout claim below is either taken from the existing code templates or from the brief and is marked accordingly.
- Therefore: the smallest complete route is **(1)** stand up the production API (Worker + D1 + R2 + custom domain `api.daycareos.ubuntutown.co.za`) from `main`, **(2)** onboard Sally's through the existing signup/provisioning path, **(3)** extend the report engine for the missing/defective fields, **(4)** implement a validated historical import for September 2026. Nothing requires a rewrite.

## 2. Verified architecture

All Cloudflare facts read via authenticated API on 2026-10-06 (account `c63d3d6d8c17db7487ab40b81d5e29d1`, "Chiefops26@gmail.com's Account"). No secrets are reproduced here.

| Piece | What serves it | Evidence |
|---|---|---|
| `app.daycareos.ubuntutown.co.za` (target app) | Pages project **`ubuntu-tenant-manager`** (direct upload, no repo link). Last deploy 2026-08-06 22:13 UTC. Bundle `/assets/index-CbK1b8r8.js` hardcodes `API_BASE = https://api.daycareos.ubuntutown.co.za/api` | Pages API + live HTML/JS (VERIFIED) |
| `demo.daycareos.ubuntutown.co.za` | Pages **`ubuntu-demo-manager`** (deploys 2026-07-13, 2026-08-06) | Pages API (VERIFIED) |
| `daycareos.ubuntutown.co.za` (marketing/signup) | Pages **`ubuntu-daycareos`**, built from `daycareos-site/` (branch `daycareos-site` @ `569630a`) | Pages API + repo (VERIFIED) |
| `demo-api.daycareos.ubuntutown.co.za` | Worker **`ubuntu-demo-worker`** (custom domain), D1 **`ubuntu-demo-db`**, R2 `ubuntu-demo-media`, `DEMO_MODE=true`, deployed 2026-07-13 (pre-Phase-5 code). `GET /api/health` → `{"ok":true}` | Workers API + curl (VERIFIED) |
| `api.daycareos.ubuntutown.co.za` (the app's configured API) | **NOTHING.** No worker custom domain, no zone route, no SaaS-configured worker in the account. TLS alert `handshake failure` (443), HTTP 522 (80) | curl + workers/domains + zone routes API (VERIFIED) |
| `api.lehakwedaycare.co.za` (the live multi-tenant instance) | Worker **`lehakwe-email-worker`** (custom domain), D1 **`lehakwe-db`**, R2 `lehakwe-media`/`lehakwe-emails`, `PAYSTACK_SECRET_KEY` set. Deployed 2026-09-15 09:13 UTC, matching `main` tip `0b81948` ("fix: case-insensitive email lookup in admin reset-password", same date) | Workers API + GitHub (VERIFIED) |
| `app.lehakwedaycare.co.za` | Pages **`lehakwe-manager`**, deploys 2026-09-15 (same date as worker deploy) | Pages API (VERIFIED) |

Source repository: **`Kekelebaka/lehakwe-daycare`** (public). Despite the name — Lehakwe is one *centre/customer* — this repository **is** the DaycareOS platform monorepo:

- `worker/` — Hono API + email intake (`src/routes/{auth,public,dashboard,people,finance,care,comms,admin,media,parent,messages,notifications,funding,billing,coordinator}.ts`, plus `tenant.ts`, `provisioning.ts`, `billing.ts`, `auth.ts`, `lib.ts`). Tests included (`*.test.ts`).
- `manager/` — React PWA (the `app.daycareos` / `app.lehakwedaycare` SPA). `db/` — D1 `schema.sql` + migrations `002`–`019`. `daycareos-site/` — marketing + signup (Pages Function lead capture). `site/`, `inbox/` — Lehakwe website and staff email inbox.
- Deploy workflow `.github/workflows/deploy.yml` is **manual** (Actions → type `DEPLOY`), currently written for the Lehakwe instance; activation comment at top of file.

Database state (read-only queries, 2026-10-06):

- `lehakwe-db`: full schema through `019` (incl. `centres`, `centre_domains`, `plans`, `subscriptions`, `payments`, `signup_intents`, `setup_tokens`, `coordinators`, `coordinator_centres`, `webhook_events`). **3 centres**: `centre-lehakwe` (Lehakwe Daycare, active), `centre-8665acba…` (Test Centre — Chief E2E, created 2026-08-06 20:11), `centre-505f4006…` (Bloemside Community Creche, plan `community`, created 2026-08-06 21:18). `centre_domains` maps `*.daycareos.ubuntutown.co.za` hosts per centre. 3 subscription rows.
- `ubuntu-demo-db`: schema through `015/016` (no billing tables). 1 centre ("Ubuntu Demo Daycare"), seeded demo data (13 children, 4 staff).

Tenancy model (**VERIFIED** in `worker/src/index.ts`, `tenant.ts`, migrations `014`/`015`):

- `centres(centre_id, slug UNIQUE, name, status trialing|active|suspended, plan, mode pooled|isolated, owner_staff_id, …)` + `centre_domains(host → centre_id)`.
- Every tenant table carries `centre_id`; `015_tenant_columns.sql` backfills and indexes it.
- The active centre comes **only** from the verified session JWT (`centre_id` claim, signed at login); middleware additionally rejects a request whose `Origin` maps to a different centre (defence in depth). Client-supplied centre ids are never trusted.
- Roles: `admin`/`owner` (job_title `Centre Manager` / `Daycare Principal`) vs `staff`, enforced server-side (`requiresAdmin` allow-list in `lib.ts`); separate parent cookie/OTP auth and coordinator auth (Ubuntu Town Supabase SSO, roles `coordinator` / `network_admin`).

Environments & workflows (**VERIFIED**): production (Lehakwe instance), DaycareOS demo (`DEMO_MODE=true` — fixed parent OTP, no outbound mail), marketing site. No staging environment exists yet. Deployment is `wrangler deploy` (worker) and `wrangler pages deploy` (frontends), or the manual GitHub Action. D1 schema is applied as ordered SQL migrations (`002`–`019`, additive/forward-only by convention).

## 3. Existing onboarding workflow (how a new centre is created today)

All three paths converge on one provisioning routine (**VERIFIED** in `worker/src/routes/public.ts`, `routes/billing.ts`, `routes/coordinator.ts`, `provisioning.ts`):

**Path A — self-serve signup (free/trial):** `POST /api/public/signup` (rate-limited per IP, optional Turnstile) → creates `centres` row (`status='trialing'`, `plan='self_service'`, `mode='pooled'`), owner `staff` row (job_title `Daycare Principal` → admin role, password hashed), `centre_domains` row for `{slug}.daycareos.ubuntutown.co.za`, seeds defaults (`seedCentreDefaults`: 11-item ECD compliance checklist, 3 starter fee schedules, settings incl. `setup_complete=false`), writes `audit_logs`, auto-logs the owner in → `/setup` wizard (Profile → Branding → Fees → Staff → Children → Finish).

**Path B — paid signup (Paystack):** `POST /api/public/checkout` → `signup_intents` → Paystack → `POST /api/public/paystack/webhook` (signature-verified; idempotency guarded on `signup_intents.status` and `payments.provider_ref` unique index) → `provisionCentre()` (centre + owner + subdomain + seed + `subscriptions` row; owner gets an unguessable password) → one-time `setup_tokens` link emailed → `POST /api/public/setup-token` → `POST /api/auth/set-password`. Renewals use the same webhook (Path B renewal branch).

**Path C — coordinator onboarding (Ubuntu Town):** coordinator SSO (`POST /api/coordinator/session`) → `POST /api/coordinator/centres` (community plan, R250 intent) → provisioned → `coordinator_centres(relationship='onboarded')`; `POST /api/coordinator/act-as/:centreId` lets the coordinator configure the centre on the owner's behalf. `network_admin` role manages coordinators and assignments (`/api/coordinator/admin/*`).

Lifecycle covered: create centre → associate authorised owner (owner is created **by the flow**; the owner's email is the signup email — nothing assumes a centre's generic contact email is an administrator) → configure (wizard + `/settings`: name, address, NPO number, phone, email, website, municipality, town, **ward**, **EMIS number**, manager name for signatures) → operational data (children, staff, attendance, fees, payslips, documents) → reports (`/reports`) → activation (`centres.status` + `subscriptions`; `BILLING_ENFORCED='true'` gates the API on subscription state — currently **off on every deployed worker**, so activation is presently unenforced).

Duplicate prevention (**VERIFIED**): unique `centres.slug` (auto-suffixed `-2`, `-3`…), unique `payments.provider_ref`, idempotent webhook. **Gap:** no uniqueness or check on centre **name** or **EMIS number** (`emis_number` is free-text in `settings`), so a duplicate Sally's is possible via two signups with different slugs. A pre-check query (name + EMIS) must precede creation.

Audit & recovery (**VERIFIED**): `audit_logs` (every mutation path writes entries incl. `signed_up`), `signup_intents`, `setup_tokens`, `webhook_events`, `payments.raw` snapshots. `lehakwe-db` also shows an operator practice of `bakYYYYMMDD_*` backup tables. D1 supports time-travel restore.

## 4. Six-report gap matrix

**Source-document caveat:** the six PDFs were **not found** in the workspace (searched `/home/ubuntu`, `/tmp`, and the Hermes caches for the exact filenames and `*.pdf` — zero hits). Everything below maps the brief's field lists onto the existing engine; "layout" columns are **NEEDS CONFIRMATION** against the real PDFs. Field-level mapping is **VERIFIED** against code/schema.

### Engine inventory (**VERIFIED** `manager/src/pages/Reports.tsx`, 1,010 lines, jsPDF + jspdf-autotable client-side)

| Existing generator | Produces | Corresponds to |
|---|---|---|
| `generateClaim` — "DSD Monthly Reporting Template" | 4 pages: Front cover (registered/approved beneficiaries, income-category breakdown, admissions, discharges, practitioners trained/employed, children with disabilities) → Summary of Beneficiaries → Attendance Register Annexure A (cols `#`, Surname & Initials, Age, days 1–22, TOTAL) → Summary of Staff Breakdown (incl. designation, training, subsidised, salary, compiler sign-off) | PDFs 01–04 |
| `generateQuarterly` — "Quarterly Expenditure Report" | Income rows (Funding received / Other Income / Total), expense table (`Operating Expenses`, `Res. Alloc. %`, `Allocated Budget`, `Expenditure GDE`, `Expenditure Other`, `Expenditure Invoice`), Total Expenditure, Surplus/(Deficit), bank opening/closing lines, compiler + board signatures | PDF 06 |
| `generateSixMonthly` — "Six Monthly Progress Report" | 8-section DSD progress report (not among the six) | — |
| **Missing** | Standalone **Monthly Income & Expenditure** statement | PDF 05 |

### A. Monthly front cover (PDF 01)

| Field (brief) | DB field | Capture screen / API | Calculation | Export | Gap | Recommended change |
|---|---|---|---|---|---|---|
| Centre identity (name, address, province, district, contact, EMIS, ward) | `settings`: `daycare_name`, `daycare_address`, `province`, `municipality`, `town`, `ward`, `emis_number`, `phone`, `official_email` (+ `centres` row) | `/settings` → `PUT /api/settings` | passthrough | `generateClaim` cover | District (Ekurhuleni North) not a first-class field (`municipality` used); REF/BP NO read from `settings.ref_number` which is never written | Add `district` + `ref_number` to Settings UI (store in `settings`); verify cover wording vs PDF |
| Approved capacity (partial-care certificate + SLA) | **none** | — | — | — | **Missing entirely** (verified: no capacity field anywhere) | Add `approved_capacity`, `certificate_number`, `certificate_expiry`, `sla_reference` to `settings` (or `documents` linkage); render on cover |
| Children claimed (registered/approved) | `children.status` | `/children` → `POST/PUT /api/children` | count of active children (both columns currently = same number) | cover table | "Approved" not distinguishable from "Registered" | Add approval flag/date or a monthly claim override |
| Income classifications (1-Parent R0–R3500 / 2-Parent R0–R4500 / Other) | `children.income_category` (`single_parent`/`dual_parent`/`other`) | `/children` form | counts | cover table | Schema has 3 buckets; the 2-Parent column renders **always blank** (code bug: `dual_parent ? '' : ''`) and brief income bands (R3500/R4500) are not captured | Fix column bug; capture band-confirming data (household income band) as its own field or confirm the 3-bucket mapping is accepted |
| Admissions / discharges | `children.enrolment_date`, `children.status` | `/children` | currently **hardcoded '0'** | cover table | New admissions not computed; source cover says 3 while child rows blank (see §5) | Compute from `enrolment_date` within period; discharges need a `discharged_date`/status change date (add column) |
| Practitioner training | `staff.training_received`, `training_type` | `/staff` | count of staff with `training_received` (fallback prints `1`) | cover row | Fallback fabricates "1" | Count strictly; blank when unknown |
| Disability counts | `children.disability`, `disability_description` | `/children` | count `='yes'` | cover row | OK | — |
| Employment statistics | `staff.active` | `/staff` | count | cover row | OK | — |
| Computer-related statistics | **none** | — | — | — | **Missing** (verified) | Add to `settings` or a centre-ICT field group |

### B. Children's summary (PDF 02)

| Field | DB | Capture | Calc | Export | Gap | Change |
|---|---|---|---|---|---|---|
| Surname & initials / file reference | `children.full_name` | `/children` | passthrough | benef. table | No file-reference field; full name printed (layout needs initials per PDF) | Add `file_reference` (or generate) + name-format helper per template |
| DOB or ID | `children.date_of_birth`, `children.id_number` | `/children` | — | DOB/ID col | — | Validate ID checksum / DOB-vs-ID consistency; flag ambiguity |
| Age (years & months) | derived | — | **bug:** years only, from `Date.now()`, 365.25-day year | Age col | No months; no reporting reference date | Compute Y/M from verified DOB vs explicit report reference date (e.g. last day of report month) |
| Demographics (M/F, B/W/C/A) | `gender`, `race` | `/children` | 1/0 markers | cols | Non-African races render hardcoded '0' | Map from `race` properly |
| Disability | `disability`, `disability_description` | `/children` | Yes/No | col | OK | — |
| Household-income classification | `income_category` | `/children` | x-marks | 3 cols | 2-Parent col bug (see A) | Fix |
| Admissions/exits | `enrolment_date`, `status` | `/children` | — | (cover) | No exit date | Add `discharged_date` |
| Attendance totals | `children.days_attended_current_month` (denormalised), `attendance_records` | `/attendance` | **bug:** falls back to `20` when 0/null | Days col | Invents totals | Derive strictly from `attendance_records` for the period; show blank/flag when unknown |

### C. Attendance Annexure A (PDF 03)

| Field | DB | Capture | Calc | Export | Gap | Change |
|---|---|---|---|---|---|---|
| Names, ages | `children` | `/children` | see B | cols 2–3 | Same age bug | Reference-date ages |
| Daily P/A marks | `attendance_records(child_id, date, status present|absent|late|excused)` | `/attendance` (`POST/PUT /api/attendance`, `GET /api/attendance?date=`) | — | day cols 1–22 | **(1)** data loaded for *today's date only* (`api.getAttendance(today)`), so a past month's register cannot render; **(2)** missing records default to **'P'** (present) — violates the no-silent-present rule; **(3)** status `late`/`excused` unmapped to P/A; **(4)** the 22-column cap (`min(daysInMonth, 22)`) assumes calendar days | **(1)** fetch the whole report month; **(2)** render unknown as blank + legend, never P; **(3)** define mapping (e.g. late→P*, excused→A? — needs centre policy); **(4)** resolve columns-as-operating-days vs calendar-dates from the PDF (NEEDS CONFIRMATION); add a per-month `operating_days` definition handling closures/holidays |
| Total days attended | derived | — | currently `days_attended_current_month \|\| maxDays` (invents values) | TOTAL col | Wrong | Count of marked present-days within defined operating days; cross-check vs report B total |
| Manager sign-off | `settings.manager_name` | `/settings` | — | footer | OK (blank line if unset) | — |

### D. Staff summary (PDF 04)

| Field | DB | Capture | Calc | Export | Gap | Change |
|---|---|---|---|---|---|---|
| Names / file references / ID | `staff.full_name`, `staff.id_number`, `employee_number` | `/staff` | — | table | `employee_number` unused in report | Map file reference |
| Demographics, disability | `gender`, `race`, `disability`, `disability_description` | `/staff` | 1/0 | cols | Non-African hardcoded '0' | Map properly |
| Designation | `staff.job_title` | `/staff` | — | col | OK | — |
| Training, qualification | `training_received`, `training_type` | `/staff` | Yes/N/A | cols | **No qualification field** (e.g. Level 5 ECD) | Add `qualification` field |
| Subsidy status | `staff.subsidised` | `/staff` | Yes/No | col | — | — |
| Gross salary | `staff.basic_salary`, `payslips.gross_pay` | `/staff`, `/payslips` | **bug:** report reads `s.salary` (field doesn't exist → renders R 0.00) | Salary col | Broken field name; also: is the PDF's "salary" basic or monthly gross incl. allowances? (basis check, §5) | Fix to `basic_salary` (or period gross from payslips — decide per PDF definition) |
| Compiler sign-off | `settings.manager_name` | `/settings` | — | footer | OK | — |

### E. Monthly income & expenditure (PDF 05) — **no generator, no ledger**

| Field | DB | Capture | Calc | Export | Gap | Change |
|---|---|---|---|---|---|---|
| Income sources (fees, DSD/Education subsidy, donations, other) | partial: `fee_records.amount_due/amount_paid/payment_method` (`nsnp_subsidy` is an enum value) | `/fees` | sum by month | — | No income ledger with source classification; subsidy split currently **invented** (`subsidy = totalIncome * 0.6`) | New `finance_entries` table (type income/expense, category, funding_source, amount_cents, date, method, invoice_ref, note, centre_id, period) + capture UI under `/fees` or new `/finance` |
| Expense categories & amounts | partial: `payslips.gross_pay/total_deductions/net_pay`, `payslip_items` | `/payslips` | — | — | Only payroll exists; utilities, rent, food, cleaning etc. have no home | Same ledger; category list per the DSD templates |
| Totals | — | — | must use integer cents | — | Current engine sums `R x,xxx.xx` **strings** | Compute in cents, format once at render |
| Period + sign-off | `settings.manager_name` | `/settings` | month selector exists | — | — | — |

### F. Quarterly expenditure (PDF 06)

| Field | DB | Capture | Calc | Export | Gap | Change |
|---|---|---|---|---|---|---|
| Quarter/year | selector in UI | — | Q1 Apr–Jun … Q4 Jan–Mar (code) | header | Verify quarter definition vs PDF (NEEDS CONFIRMATION) | — |
| Funding received / other income | — | — | **invented** 60/40 split of fee income | income rows | No subsidy capture | Ledger `funding_source`; feed real values |
| Allocation percentages (50/4/14/3/25/4) | hardcoded `EXPENSE_CATEGORIES` | — | budget = totalIncome × pct | cols | Matches the brief's category shape; percentages must be confirmed vs PDF | Keep as configurable constants once confirmed |
| Allocated budget vs actual expenditure | — | — | **bug:** "actual" = allocated budget (except Governance = payroll) | 3 exp. cols | No expense actuals; "Expenditure Other" hardcoded R 0.00 | Ledger actuals by funding source (GDE/Education vs Other) |
| Invoice totals | — | — | — | invoice col | No invoice tracking | `finance_entries.invoice_ref` + count/sum per row |
| Bank charges / assets | — | — | — | — | Missing (brief lists these rows) | Add ledger categories |
| Surplus/deficit | — | — | income − expenses (string parsing) | line | Arithmetic on formatted strings | Integer cents |
| Opening/closing bank balances | — | — | printed as `R ____` blanks | lines | No bank-balance model; brief warns surplus ≠ balance movement | New `bank_balances(date, balance_cents)` capture; period movements derived, never assumed |
| Authorisations (compiler + board member) | `settings.manager_name` | `/settings` | — | signatures | Board member name field missing | Add `board_member_name` or per-report signatory fields |

Cross-cutting (**VERIFIED**):

- **No draft/reviewed/final states** and **no historical snapshots**: `monthly_reports(report_id, month, year, generated_at, generated_by, data_json)` exists in `schema.sql` but is referenced **nowhere** in the worker (grep verified) and holds 0 rows in both DBs. Reports are rebuilt from live data on every click, filenames/branding are hardcoded "Lehakwe".
- **PDF generation is client-side only** (jsPDF in the browser). Adequate for layout fidelity control; but for reproducibility + authorised downloads the generated PDF must also be stored (R2 pattern already exists: `documents/{centreId}/…` streamed via authenticated `GET /api/documents/:id/file` with `Cache-Control: private`).
- **Privacy**: the beneficiary/staff reports contain names + ID numbers. Generation is already behind staff auth and tenant scoping; stored copies must stay in the centre-prefixed private R2 keyspace and never enter git, fixtures or logs (acceptance criterion).

## 5. Data exceptions & reconciliation

Source PDFs unavailable ⇒ the values below are **as stated in the brief**; arithmetic was re-computed exactly (integer/decimal). Each row needs confirmation against the PDFs and/or Sally's before import.

| # | Exception (brief) | Independent check | Classification | Who confirms |
|---|---|---|---|---|
| 1 | Cover records 3 new admissions but child-level admission fields blank | Cannot verify without PDFs. Systemically: admissions are currently hardcoded '0' in the engine anyway | NEEDS CONFIRMATION | Sally's manager (which 3 children, admission dates) |
| 2 | Ages differ between beneficiary summary and attendance register | Plausible: engine computes age at click-time with `Date.now()` and 365.25-day years; two different generation runs can disagree; no months shown | INFERRED (mechanism verified in code) | Recompute from DOB + one reference date; Sally's confirms DOBs |
| 3 | Attendance numbered columns 1–22 but ~21 marked days per child | Engine caps at 22 columns and treats them as calendar days 1–22; whether the source uses operating-day slots vs calendar dates is unresolved (a 21st/22nd falling on a closure would explain a blank) | NEEDS CONFIRMATION | Inspect PDF header (dates vs sequence numbers); Sally's confirms closure days |
| 4 | Sept expenditure R26,640.33 vs education income R25,872 → shortfall | Arithmetic confirmed: 26,640.33 − 25,872.00 = **768.33** | CONFIRMED ARITHMETIC (values NEED CONFIRMATION vs PDF) | Sally's treasurer/compiler; do not "fix" — record as period deficit |
| 5 | Quarterly cleaning row R1,691.20 + R2,000 = R3,691.20 vs invoice cell R3,961.20 | Components sum to **3,691.20**; invoice cell exceeds by **270.00** unexplained | CONFIRMED ARITHMETIC discrepancy (values NEED CONFIRMATION) | Sally's (which invoices; possibly a third invoice of R270.00 or a transcription error) |
| 6 | Quarterly components R44,348.86 + R19,490.72 = R63,839.58 | Arithmetic confirmed: **63,839.58** | CONFIRMED ARITHMETIC | — |
| 7 | Staff gross salaries vs financial-report salary expenditure | Different measures possible (basic vs gross incl. allowances; monthly vs quarterly; paid vs accrued). Engine has both `staff.basic_salary` and `payslips.gross_pay` | NEEDS CONFIRMATION — must NOT be forced to match | Sally's + DSD reporting definition |

Proposed corrections are kept **separate** from source values: none of the above should be silently altered on import. Import rule: store the source value as given, attach an exception note, and require a confirmation flag before figures enter final reports.

Sally's onboarding data (brief; centre-level only — **not verified against the PDFs**, which are unavailable):

| Attribute | Value | Status |
|---|---|---|
| Centre | Sally's Day Care Centre | NEEDS CONFIRMATION vs PDFs |
| Address | 84 Xubeni Section, Tembisa, Gauteng | NEEDS CONFIRMATION |
| District / Ward / EMIS | Ekurhuleni North / 4 / 700900274 | NEEDS CONFIRMATION (EMIS held as string) |
| Contact / email | 072 *** 2715 / s***@gmail.com (masked here) | NEEDS CONFIRMATION; **email ≠ authorised admin** until Sally's confirms |
| Reporting period | September 2026 (historical) | Historical — must not seed current enrolment/finances |
| Children / staff listed | 28 / 4 | Historical snapshots, not current operational counts |

## 6. Recommended implementation — smallest complete route

Deliberately inside the existing architecture (Hono worker + D1 + R2 + Pages SPAs + jsPDF). No framework change; the reporting engine is extended, not replaced (jsPDF gives us exact-layout control and is already proven in this codebase).

**Step 0 — stand up the DaycareOS production backend (unblocks everything).**
New Worker `daycareos-api` from `worker/` @ `main` with a new `worker/wrangler.saas.toml`: D1 `daycareos-db` (schema.sql + migrations 002–019), R2 `daycareos-media`, vars `TENANT_BASE_DOMAIN=daycareos.ubuntutown.co.za`, `APP_BASE_URL=https://app.daycareos.ubuntutown.co.za`, `COOKIE_DOMAIN=.ubuntutown.co.za`, `ALLOWED_ORIGIN=https://app.daycareos.ubuntutown.co.za,https://*.daycareos.ubuntutown.co.za`, secrets `JWT_SECRET` (+ `PAYSTACK_SECRET_KEY` only if paid signup is wanted now), `BILLING_ENFORCED` left off until subscriptions are live. Attach custom domain `api.daycareos.ubuntutown.co.za` (Cloudflare provisions the cert; the OAuth deploy token lacks DNS rights — same caveat documented in `wrangler.demo.toml`). Frontend needs **no change** (its API base is already correct). Health check: `GET /api/health`, CORS preflight from the app origin, login round-trip.
*Files:* `worker/wrangler.saas.toml` (new), `docs/deployment/daycareos-production.md` (runbook). *Effort: 0.5–1 day incl. validation.*

**Step 1 — onboarding Sally's through the product.**
Use Path B/C (coordinator or owner self-serve) — never raw SQL. Pre-checks (name + EMIS, then slug) via read queries; provision with slug `sallys-daycare`; record `settings` (name, address `84 Xubeni Section, Tembisa, Gauteng`, province `Gauteng`, municipality/district `Ekurhuleni North`, `ward` `4`, `emis_number` `700900274`, phone/email as strings). Owner linkage: **pending Sally's confirmation** of the authorised administrator — do not auto-grant the contact email. Small code addition: EMIS/name duplicate guard (extend `uniqueSlug`-style check to `settings.emis_number` + `centres.name`, and add a UNIQUE index on `(emis_number)` where non-empty — migration `020`). *Effort: 0.5 day.*

**Step 2 — validated historical import (September 2026).**
New admin endpoint `POST /api/import/legacy` (or a CLI that calls the same zod-validated service layer) with: an import manifest (source = the six PDFs, period), natural idempotency keys (child: `full_name + date_of_birth`; staff: `id_number` or `employee_number`; finance rows: `period + category + invoice_ref`), `source='legacy_import'` + `import_batch` id on every row (new columns via migration `020`), re-run returns `created/updated/skipped` counts. Historical values must not silently become current: children imported with `enrolment_date` as-of September 2026 and a flag `historical_snapshot=1` (or imported to the ledger/period tables only where the schema distinguishes periods — `fee_records(year, month)` and the new finance ledger are period-natural). Synthetic dry-run fixture first (never real records in tests). *Files:* `worker/src/import.ts`, `worker/src/routes/admin.ts` (endpoint), `db/migrations/020_legacy_import.sql`. *Effort: 2–3 days incl. tests.*

**Step 3 — report engine completion (the six outputs).**
In `manager/src/pages/Reports.tsx` (+ new `manager/src/lib/report-data.ts` for pure, testable computation):
1. Fix the verified defects: month-scoped attendance fetch; unknown marks rendered blank (never P); age Y/M from DOB + explicit reference date; days-attended derived from records (no `|| 20`, no `|| maxDays`); `basic_salary` field name; 2-Parent column; race-column mapping; remove fabricated fallbacks (training count "1", 60/40 subsidy, staff×5000 subsidy rows, hardcoded Lehakwe narrative/filenames — branding must come from `settings`).
2. New fields (migration `020`/`021` + Settings UI): `district`, `ref_number`, `approved_capacity`, `certificate_number`, `certificate_expiry`, `sla_reference`, computer/ICT stats, `qualification` (staff), `discharged_date` (children), `board_member_name`.
3. New finance ledger (`finance_entries`) + `/finance` capture screen; integer-cents arithmetic throughout; expense categories = the DSD set (cost of nutrition 50%, facility 4%, governance 14%, ECD programmes 3%, professional services 25%, healthy living 4% — confirm vs PDF 06); allocation % kept as data, not code.
4. **Monthly Income & Expenditure generator (PDF 05)** — new `generateMonthlyIE()`.
5. Attendance column mapping: a per-month `operating_days` definition (dates the centre operated) exported as numbered operating-day slots or calendar days per what PDF 03 shows; closures/holidays excluded from totals; unknown entries stay blank and are counted as unmarked, never present.
6. Report lifecycle: `report_runs(run_id, centre_id, report_type, period, state draft|reviewed|final, input_json, totals_json, pdf_key, created_by, created_at)` (reuse/retire the dormant `monthly_reports`), PDF stored to R2 `documents/{centreId}/reports/{runId}.pdf`, downloadable only via the authenticated, centre-scoped file endpoint. **Finalised runs are immutable** — historical reproduction reads `input_json`, not live tables.
*Effort: 5–8 days.*

**Step 4 — hardening & evidence.** Tenant-isolation tests (extend `worker/src/tenant.test.ts`), E2E on staging, D1 backup/export routine, runbook. *Effort: 2–3 days.*

Total realistic effort: **~2 weeks** of focused work (10–15 dev-days) including validation; Step 0 alone unblocks onboarding immediately.

## 7. Activation & rollback runbook (summary — full detail in implementation phase)

1. **Staging:** deploy `daycareos-api` with a staging D1 (`daycareos-db-staging`) + `wrangler saas` config marked `APP_ENV=staging`; point a staging Pages project (`ubuntu-tenant-manager-staging`) at it. Apply schema + migrations. Seed **synthetic** data only.
2. **Validation (staging):** health + CORS; signup → wizard → records → all six report generations against fixture data with known expected totals; tenant-isolation tests (centre A token vs centre B data/files = 403/404); attendance unknown-entry rendering; import dry-run with a synthetic batch; PDF layout review against the six PDFs (once supplied); reproducibility check (finalise a run, mutate records, re-render from snapshot — identical output).
3. **Production activation (ordered):** create D1 `daycareos-db` + R2 `daycareos-media` → apply `schema.sql` + `002`–`020` → deploy worker `daycareos-api` (no custom domain yet) → verify on `*.workers.dev` → attach custom domain `api.daycareos.ubuntutown.co.za` → verify `GET https://api.daycareos.ubuntutown.co.za/api/health` + login round-trip from `app.daycareos` → pre-check Sally's duplicates (name/EMIS) → provision Sally's via API flow → confirm owner access with the confirmed administrator → Settings config (EMIS/ward/district) → import September 2026 as a **draft** batch → generate all six reports as drafts → Sally's reviews → mark final → only then treat reports as issued.
4. **Rollback:** worker = `wrangler rollback` (or redeploy previous version — version history retained); Pages = redeploy previous deployment id (ids recorded above); DNS/custom domain detach is instant; D1 = time-travel restore to pre-activation timestamp + `bak`-style snapshot tables before the import; the import batch id allows surgical deletion (`WHERE import_batch = ?`) if the batch must be withdrawn. Nothing in activation mutates the Lehakwe or demo instances.
5. **Not to be done until explicitly approved:** enabling `BILLING_ENFORCED`, sending invitations/emails to Sally's contacts, importing real personal records, publishing reports.

## 8. Acceptance evidence (what the implementation phase must prove)

1. Sally's exists exactly once (name + EMIS query returns 1 row) and the confirmed administrator can sign in at `app.daycareos.ubuntutown.co.za` and sees only Sally's data.
2. Lehakwe + demo instances unchanged (row counts + smoke tests before/after).
3. Cross-tenant probes fail: centre-A session reading centre-B children/staff/files/exports returns 403/404 (automated tests + one manual probe per resource class).
4. Import re-run is a no-op (created=0, skipped=N) — idempotency evidence in the response payload.
5. All six PDFs regenerated with the supplied layouts: side-by-side visual diff per page, readable text, no clipped columns (esp. Annexure A's 22 day columns and the 16-column staff table).
6. Attendance totals identical across Annexure A and the beneficiary summary (computed from one source query).
7. Financial rows sum to totals in integer cents; the R768.33 shortfall, the R270.00 cleaning discrepancy and any unconfirmed figure appear **visibly flagged** in the report exception note, not silently absorbed.
8. Reproducibility: a finalised September 2026 run re-renders byte-equivalent content after live records change (snapshot-driven).
9. The **deployed** application (not a local build) completes: signup/provision → capture → import → draft → review → final → authorised download. Evidence captured as: API transcripts, generated PDFs, screenshot of the deployed UI, and DB read-backs.

## Appendix A — evidence log (2026-10-06)

- Cloudflare API (OAuth, account `c63d…29d1`): pages projects + deployments, workers scripts/settings/bindings/custom domains/zone routes, D1 list + read-only `SELECT` queries against `ubuntu-demo-db` and `lehakwe-db`.
- curl: `https://app.daycareos.ubuntutown.co.za` (200, bundle `index-CbK1b8r8.js` contains `https://api.daycareos.ubuntutown.co.za/api`), `https://api.daycareos.ubuntutown.co.za` (TLS handshake failure / 522), `https://demo-api.daycareos.ubuntutown.co.za/api/health` (200 `{"ok":true}`).
- GitHub: `Kekelebaka/lehakwe-daycare` branches/tips; local clone @ `main` `0b81948`; code read of `worker/src/{index,tenant,provisioning,lib,env}.ts`, `routes/{public,admin,coordinator,billing,auth,people,care}.ts`, `db/schema.sql`, `db/migrations/002–017`, `manager/src/pages/{Reports,SetupWizard,Settings}.tsx`, `manager/src/lib/api.ts`, `manager/src/App.tsx`.
- Filesystem: full search for the six PDFs — **zero results** (checked `/home/ubuntu`, `/tmp`, Hermes caches; exact filenames + `*.pdf`).
- Arithmetic re-computation of the brief's financial claims (decimal exact).

## Appendix B — evidence status index

| Claim | Status |
|---|---|
| `app.daycareos` frontend deployed; its configured API host is dead (no worker/route) | VERIFIED |
| Multi-tenant platform code complete on `main` (signup, provisioning, coordinator, billing, RBAC, seeding) | VERIFIED |
| Live multi-tenant instance = `lehakwe-email-worker` + `lehakwe-db` (3 centres; 2 created via product flows on 2026-08-06) | VERIFIED |
| `ubuntu-demo-worker`/`ubuntu-demo-db` = demo instance (DEMO_MODE, July code) | VERIFIED |
| Sally's absent from both DBs (name/EMIS/email checks) | VERIFIED |
| Six PDFs not delivered to the workspace | VERIFIED (absence) |
| Report engine covers PDFs 01–04 + 06 structurally; PDF 05 missing; ~10 engine defects listed | VERIFIED (code); layouts NEED CONFIRMATION vs PDFs |
| Existing `monthly_reports` table unused; no draft/final states; client-side-only PDFs | VERIFIED |
| Attendance columns 1–22 semantics (operating slots vs calendar) | NEEDS CONFIRMATION (PDF 03) |
| Discrepancies #1–#7 in §5 | arithmetic VERIFIED; source values NEED CONFIRMATION (PDFs) |
| Sally's authorised administrator identity | NEEDS CONFIRMATION (do not assume the contact email) |
| Smallest complete route = deploy production backend + existing flows + engine/ledger extension (~10–15 dev-days) | INFERRED (from verified code inventory) |
