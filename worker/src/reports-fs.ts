/**
 * Free State Province ECD statutory reporting.
 *
 * Reproduces two forms from the Free State Department of Education ECD subsidy
 * pack, populated from the centre's own records:
 *
 *   1. "ECD Subsidy: Monthly attendance report/ record"   (pack page 23)
 *   2. "Annexure B Income and Expenditure Statement"      (pack pages 20-21)
 *
 * Both are signed and witnessed documents, so the output is a print-ready A4
 * page rather than a data export: the centre prints it, checks it, signs it.
 * Sections the system cannot yet evidence (itemised expenditure) are rendered
 * as ruled blank rows to complete by hand, never as invented figures.
 *
 * The helpers below are deliberately pure so they can be unit-tested without a
 * database.
 */

export type MonthKey = { year: number; month: number; label: string };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The government financial year runs April -> March, and the attendance form is
 * laid out in that order (April first, March last, then an annual total). Given
 * the starting calendar year, return the twelve months in form order.
 */
export function financialYearMonths(startYear: number): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = 0; i < 12; i++) {
    const m = 4 + i; // April = 4
    const year = m <= 12 ? startYear : startYear + 1;
    const month = m <= 12 ? m : m - 12;
    out.push({ year, month, label: MONTH_NAMES[month - 1] });
  }
  return out;
}

/** Week days (Mon-Fri) in a calendar month. `month` is 1-12. */
export function weekdaysInMonth(year: number, month: number): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export type AttendanceRow = { date: string; child_id: string; status: string; subsidised: number };

export type MonthStats = {
  label: string;
  year: number;
  month: number;
  maxOnDay: number;
  minOnDay: number;
  daysOpen: number;
  weekdays: number;
  targetDays: number;
  subsidisedDays: number;
  allDays: number;
};

/** Statuses that count as the child having attended for subsidy purposes. */
export function isAttended(status: string): boolean {
  return status === 'present' || status === 'late';
}

/**
 * Fold raw attendance rows into the per-month figures the form asks for.
 *
 * "Days open" is derived from the dates that actually carry attendance records,
 * because the system has no separate record of opening days. That is a proxy: a
 * day where nobody captured the register looks like a closed day, which is why
 * the rendered page reports days-open alongside the calendar weekday count so
 * the centre can see any gap.
 *
 * "Target" follows the pack's definition: funded places x days open.
 */
export function aggregateAttendance(
  rows: AttendanceRow[],
  months: MonthKey[],
  fundedPlaces: number,
): MonthStats[] {
  return months.map(({ year, month, label }) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const inMonth = rows.filter((r) => (r.date || '').startsWith(prefix));

    // date -> children attended that date
    const perDay = new Map<string, { all: number; subsidised: number }>();
    for (const r of inMonth) {
      if (!isAttended(r.status)) continue;
      const cur = perDay.get(r.date) || { all: 0, subsidised: 0 };
      cur.all += 1;
      if (r.subsidised) cur.subsidised += 1;
      perDay.set(r.date, cur);
    }

    const counts = [...perDay.values()].map((v) => v.all);
    const daysOpen = perDay.size;
    return {
      label,
      year,
      month,
      maxOnDay: counts.length ? Math.max(...counts) : 0,
      minOnDay: counts.length ? Math.min(...counts) : 0,
      daysOpen,
      weekdays: weekdaysInMonth(year, month),
      targetDays: fundedPlaces * daysOpen,
      subsidisedDays: [...perDay.values()].reduce((s, v) => s + v.subsidised, 0),
      allDays: counts.reduce((s, v) => s + v, 0),
    };
  });
}

export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const money = (n: number): string =>
  'R ' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Shared print stylesheet: A4, hairline rules, no colour dependence. */
export const FORM_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#000}
.sheet{background:#fff;width:210mm;min-height:297mm;margin:10mm auto;padding:12mm 10mm;box-shadow:0 1px 6px rgba(0,0,0,.25)}
.crest{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}
.crest .dept{text-align:right;font-size:9pt;line-height:1.25}
.crest .dept b{font-size:13pt;letter-spacing:.5px}
h1{font-size:15pt;margin:0 0 2mm;font-weight:bold}
h2{font-size:11pt;margin:5mm 0 2mm;text-decoration:underline}
table{width:100%;border-collapse:collapse;font-size:8pt}
th,td{border:1px solid #000;padding:1.4mm 1.6mm;vertical-align:top;text-align:left}
th{font-weight:bold;background:#f1f1f1}
td.n,th.n{text-align:right}
.lbl{width:58%}
.blank{height:7mm}
.sign{margin-top:6mm;width:70%}
.sign td{height:9mm}
.note{font-size:7.5pt;color:#333;margin-top:3mm;font-style:italic}
.panel{width:210mm;margin:0 auto 4mm;padding:4mm 6mm;background:#fff7ed;border:1px solid #fdba74;font-size:9pt;line-height:1.45}
.panel h3{margin:0 0 2mm;font-size:10pt}
.panel ul{margin:0;padding-left:5mm}
.actions{width:210mm;margin:6mm auto;text-align:right}
button{font:inherit;padding:2mm 5mm;cursor:pointer}
@media print{
  body{background:#fff}
  .sheet{margin:0;box-shadow:none;width:auto;min-height:0;padding:8mm}
  .panel,.actions{display:none}
  .pagebreak{page-break-before:always}
  @page{size:A4;margin:8mm}
}
`;

export function crest(): string {
  return `<div class="crest">
    <div></div>
    <div class="dept"><b>education</b><br>Department of<br>Education<br>FREE STATE PROVINCE</div>
  </div>`;
}

/** Screen-only panel telling the user exactly which figures are not evidenced. */
export function dataQualityPanel(issues: string[]): string {
  if (!issues.length) {
    return `<div class="panel"><h3>Data check</h3>Every figure on this form comes from captured records. Print, check and sign.</div>`;
  }
  return `<div class="panel"><h3>Read before you submit — ${issues.length} item(s) need attention</h3>
    <ul>${issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
    This panel does not print.</div>`;
}

export function printButton(): string {
  return `<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>`;
}
