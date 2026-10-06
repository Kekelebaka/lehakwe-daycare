# Finance — Domain Gap Analysis (Sally's migration findings)

## 1. Source data → current schema → gap → required model

| Source (document) | Source content | Current DaycareOS schema | Gap | Required domain model |
|---|---|---|---|---|
| D5 monthly I&E | Income by source (Dept of Education 25,872.00); expenditure by category (salaries split principal/practitioners, electricity, groceries, cleaning, gas); printed total 26,640.33 | `fee_records` = per-child fees (amount_due/paid, month/year); `payslips`/`payslip_items` = payroll | No income-by-source ledger; no expense categories; summaries would be misposted as per-child fees (double-count risk) | `ledger_entries` (income/expense, category, funding_source, period, amount_cents) |
| D6 quarterly | Income (GDE funding 44,352.00 / other 20,500.00); 6 operating-expense categories with allocation %, allocated budget, GDE/other/invoice columns; bank charges; totals; bank balances; surplus BLANK | Nothing maps: allocation % hardcoded in report code, budget = f(income) invented at render | No budget model, no funding-source split, no invoice totals, no bank balances | `budget_allocations`, `ledger_entries.funding_source`, `invoice_total_cents`, `bank_balances` |
| D4 staff | Gross monthly salary per staff member (sum 15,987.00) | `staff.basic_salary` (basic ≠ gross); `payslips.gross_pay` | Basis ambiguity (DR-09): gross vs basic vs expense line | Store measure explicitly (`salary_measure` + period), or keep in ledger as salary expense with provenance |
| D1 cover | Claimed children, income-class counts | `children.income_category` only | Claim/period reporting layer missing | `report_periods` + claim snapshot (report layer, not ledger) |
| Provenance | source doc/row/cell, raw value, verification state | None | No provenance anywhere | Every ledger row carries source + verification state |
| Reconciliation | printed vs calculated totals (row 6 = 3,961.20 printed vs 3,691.20 components; grand totals consistent with components + bank charges) | None | Printed values and calculated values must coexist | `report_exceptions` + `printed_value` vs `calculated_value` fields |

## 2. Findings specific to Sally's data
1. **Allocated budgets are formulaic in the source:** every allocated budget = allocation % × GDE funding received (44,352.00), not × total income. The model must store the **basis** ("SLA/costing framework applied to funding received") rather than recompute silently.
2. **Two funding streams, one bank movement:** bank movement (3.14) equals exactly the GDE surplus (44,352.00 − 44,348.86); the other-fund surplus (1,009.28) has no bank counterpart. Do not model "surplus = bank movement".
3. **Printed vs calculated must both survive:** row 6 invoice cell and its component sum differ by 270.00 (DR-13); the grand invoice total (63,839.58) equals GDE total + other total and is consistent with the *component* value. The ledger stores printed values with an exception flag; calculated values live in the report layer.
4. **Monthly and quarterly are different granularities:** D5 is one month, D6 is a quarter (year unprinted). Do not roll monthly rows into the quarter automatically (double-count rule 6).
5. **Salary lines are not payroll:** D5 "Practitioners Salaries" 7,392.00 and "Principal" 4,139.52 differ from D4 gross figures; no deductions may be invented to reconcile (DR-09).

## 3. Verdict
DaycareOS **needs a lightweight centre ledger** supporting: income, expenses, funding/grants, bank charges, salary expenditure, other income, budget allocation, period, source document, notes, provenance, verification state. Without it, any financial reporting (including "Charlotte's" future use) risks corrupting accounting meaning — exactly what forcing D5/D6 into `fee_records` would do.

`finance-ledger-proposal.sql` (UNAPPLIED — review required) implements this additively: `ledger_periods`, `ledger_entries`, `budget_allocations`, `bank_balances`, `report_exceptions`. All rows are centre-scoped; amounts are INTEGER cents; printed and calculated values are separate; every row carries `source_doc/source_row/raw_value/verification_state/import_batch`. It deliberately does not touch `fee_records` or `payslips`.
