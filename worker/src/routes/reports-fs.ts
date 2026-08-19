import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getCentreId } from '../tenant';
import {
  FORM_CSS, crest, dataQualityPanel, printButton, escapeHtml, money,
  financialYearMonths, aggregateAttendance, type AttendanceRow, type MonthStats,
} from '../reports-fs';

const r = new Hono<AppEnv>();

/** Financial year to report on: April YYYY -> March YYYY+1. Defaults to the current one. */
function resolveYear(q: string | undefined): number {
  const now = new Date();
  const current = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const n = parseInt(q || '', 10);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : current;
}

async function loadCentre(c: any, centre: string) {
  const row = await c.env.DB.prepare(
    'SELECT name, npo_number, address, municipality, province, official_email FROM centres WHERE centre_id = ?',
  ).bind(centre).first();
  const settingsRows = await c.env.DB.prepare(
    'SELECT setting_key, setting_value FROM settings WHERE centre_id = ?',
  ).bind(centre).all();
  const s: Record<string, string> = {};
  for (const row2 of (settingsRows.results || []) as any[]) s[row2.setting_key] = row2.setting_value;
  return { centre: (row || {}) as any, s };
}

const html = (c: any, body: string) =>
  c.newResponse(body, 200, { 'Content-Type': 'text/html; charset=utf-8' });

// ── ECD Subsidy: Monthly attendance report / record (pack page 23) ──
r.get('/reports/free-state/attendance', async (c) => {
  const centreId = getCentreId(c);
  const year = resolveYear(c.req.query('year'));
  const { centre, s } = await loadCentre(c, centreId);

  const months = financialYearMonths(year);
  const from = `${year}-04-01`;
  const to = `${year + 1}-04-01`;

  const rows = await c.env.DB.prepare(
    `SELECT a.date, a.child_id, a.status, COALESCE(ch.subsidised, 0) AS subsidised
       FROM attendance_records a
       JOIN children ch ON ch.child_id = a.child_id AND ch.centre_id = a.centre_id
      WHERE a.centre_id = ? AND a.date >= ? AND a.date < ?`,
  ).bind(centreId, from, to).all<AttendanceRow>();

  const enrolled = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n, SUM(COALESCE(subsidised,0)) AS subs FROM children WHERE centre_id = ? AND status = 'active'",
  ).bind(centreId).first<any>();

  const fundedPlaces = parseInt(s.subsidised_places || '', 10) || Number(enrolled?.subs || 0);
  const capacity = s.registered_capacity || '';
  const stats = aggregateAttendance(rows.results || [], months, fundedPlaces);

  const tot = (k: keyof MonthStats) => stats.reduce((sum, m) => sum + Number(m[k] || 0), 0);

  const issues: string[] = [];
  if (!(rows.results || []).length) {
    issues.push(
      'No attendance has been captured for this financial year, so every monthly figure is zero. The daily register must be marked in the app (or back-captured from the paper registers) before this form can be submitted.',
    );
  }
  if (!capacity) issues.push('Registered capacity is not set. Add it under Settings as "registered_capacity".');
  if (!fundedPlaces) issues.push('No subsidised places recorded, so target days compute to zero. Set "subsidised_places" in Settings, or flag the funded children.');
  if (!s.dept_reference_number) issues.push('Department reference number is not set. Add "dept_reference_number" in Settings.');
  const gaps = stats.filter((m) => m.daysOpen > 0 && m.daysOpen < m.weekdays - 2);
  if (gaps.length) {
    issues.push(
      `Register gaps: ${gaps.map((g) => `${g.label} has ${g.daysOpen} captured day(s) against ${g.weekdays} week days`).join('; ')}. Uncaptured days read as closed days and lose subsidy.`,
    );
  }

  const body = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>ECD Subsidy monthly attendance — ${escapeHtml(centre.name)} — ${year}/${String(year + 1).slice(2)}</title>
<style>${FORM_CSS}</style></head><body>
${dataQualityPanel(issues)}
${printButton()}
<div class="sheet">
  ${crest()}
  <table>
    <tr><th colspan="7" style="text-align:center;font-size:11pt">ECD Subsidy: Monthly attendance report/ record</th></tr>
    <tr><th class="lbl">Name of ECD Centre</th><td colspan="6">${escapeHtml(centre.name)}</td></tr>
    <tr><th class="lbl">Department reference number</th><td colspan="6">${escapeHtml(s.dept_reference_number || s.emis_number || '')}</td></tr>
    <tr><th class="lbl">Registered capacity of the ECD centre</th><td colspan="6">${escapeHtml(capacity)}</td></tr>
    <tr><th class="lbl">Number of places / children funded by ECD subsidy</th><td colspan="6">${fundedPlaces}</td></tr>
    <tr><th class="lbl">Annual number of child attendance days for all children attending the ECD centre</th><td colspan="6" class="n">${tot('allDays')}</td></tr>
    <tr><th class="lbl">Annual number of child attendance days for children funded by an ECD subsidy</th><td colspan="6" class="n">${tot('subsidisedDays')}</td></tr>
  </table>

  <table style="margin-top:4mm">
    <tr>
      <th>Month</th>
      <th>Maximum number of children attending on a single day in the month</th>
      <th>Minimum number of children on a single day in the month</th>
      <th>Number of week days on which the ECD centre was open in the month</th>
      <th>Target number of child attendance days for the month</th>
      <th>Total number of child attendance days for the month for children that are being funded by an ECD subsidy</th>
      <th>Total number of child attendance days for the month for all children attending the ECD centre</th>
    </tr>
    ${stats.map((m) => `<tr>
      <td>${m.label}</td>
      <td class="n">${m.maxOnDay}</td>
      <td class="n">${m.minOnDay}</td>
      <td class="n">${m.daysOpen}</td>
      <td class="n">${m.targetDays}</td>
      <td class="n">${m.subsidisedDays}</td>
      <td class="n">${m.allDays}</td>
    </tr>`).join('')}
    <tr>
      <th>Annual total</th>
      <th class="n">${stats.length ? Math.max(...stats.map((m) => m.maxOnDay)) : 0}</th>
      <th class="n">&nbsp;</th>
      <th class="n">${tot('daysOpen')}</th>
      <th class="n">${tot('targetDays')}</th>
      <th class="n">${tot('subsidisedDays')}</th>
      <th class="n">${tot('allDays')}</th>
    </tr>
  </table>

  <table class="sign">
    <tr><th>Initial Here:</th><th>Organisation</th></tr>
    <tr><td>Department:</td><td></td></tr>
    <tr><td>Witness 1:</td><td>Witness 1:</td></tr>
    <tr><td>Witness 2:</td><td>Witness 2:</td></tr>
  </table>
  <div class="note">Financial year April ${year} to March ${year + 1}. Figures compiled from the centre's daily attendance register on ${new Date().toISOString().slice(0, 10)}.
  Enrolled children: ${Number(enrolled?.n || 0)}. Week days open is taken from days on which the register was captured.</div>
</div>
</body></html>`;
  return html(c, body);
});

// ── Annexure B: Income and Expenditure Statement (pack pages 20-21) ──
r.get('/reports/free-state/annexure-b', async (c) => {
  const centreId = getCentreId(c);
  const year = resolveYear(c.req.query('year'));
  const { centre, s } = await loadCentre(c, centreId);
  const from = `${year}-04-01`;
  const to = `${year + 1}-04-01`;

  // Subsidy money actually received, evidenced by fee records settled as subsidy.
  const received = await c.env.DB.prepare(
    `SELECT payment_date, SUM(amount_paid) AS amount
       FROM fee_records
      WHERE centre_id = ? AND payment_method = 'nsnp_subsidy' AND amount_paid > 0
        AND payment_date >= ? AND payment_date < ?
      GROUP BY payment_date ORDER BY payment_date`,
  ).bind(centreId, from, to).all<any>();
  const receivedRows = received.results || [];
  const totalReceived = receivedRows.reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);

  // Personal emoluments, evidenced by payslips in the period.
  const pay = await c.env.DB.prepare(
    `SELECT s.full_name, s.job_title, COUNT(*) AS slips, SUM(p.gross_pay) AS gross
       FROM payslips p JOIN staff s ON s.staff_id = p.staff_id
      WHERE p.centre_id = ?
        AND ((p.pay_period_year = ? AND p.pay_period_month >= 4) OR (p.pay_period_year = ? AND p.pay_period_month <= 3))
      GROUP BY p.staff_id ORDER BY s.full_name`,
  ).bind(centreId, year, year + 1).all<any>();
  const payRows = pay.results || [];
  const totalEmoluments = payRows.reduce((sum: number, x: any) => sum + Number(x.gross || 0), 0);

  const agreementValue = parseFloat(s.transfer_agreement_value || '') || 0;
  const totalExpenditure = totalEmoluments; // only evidenced category
  const balance = totalReceived - totalExpenditure;

  const issues: string[] = [];
  if (!receivedRows.length) issues.push('No subsidy receipts are recorded, so "total transferred funds received" is zero. Capture each transfer as a fee record with payment method "nsnp_subsidy", or write the amounts on the printed form.');
  if (!payRows.length) issues.push('No payslips exist for this financial year, so personal emoluments is zero. Generate payslips under Payslips.');
  if (!s.transfer_agreement_number) issues.push('Transfer agreement number and date are not set. Add "transfer_agreement_number", "transfer_agreement_date" and "transfer_agreement_value" in Settings.');
  issues.push('The system does not yet keep an expenditure ledger, so service delivery, other goods and services, and capital items print as blank ruled rows for completion by hand. Total expenditures and the surplus/deficit therefore cover salaries only.');

  const blankRows = (n: number, cols: number) =>
    Array.from({ length: n }).map(() => `<tr>${Array.from({ length: cols }).map(() => '<td class="blank"></td>').join('')}</tr>`).join('');

  const body = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Annexure B Income and Expenditure — ${escapeHtml(centre.name)} — ${year}/${String(year + 1).slice(2)}</title>
<style>${FORM_CSS}</style></head><body>
${dataQualityPanel(issues)}
${printButton()}

<div class="sheet">
  ${crest()}
  <h1>Annexure B Income and<br>Expenditure Statement format</h1>
  <h2>Income and Expenditure Statement</h2>
  <table>
    <tr><th class="lbl">Name of NPO</th><td>${escapeHtml(centre.name)}${centre.npo_number ? ' — ' + escapeHtml(centre.npo_number) : ''}</td></tr>
    <tr><th class="lbl">Name of Department</th><td>${escapeHtml(s.reporting_department || 'Department of Education, Free State Province')}</td></tr>
    <tr><th class="lbl">Serving District/s</th><td>${escapeHtml(s.serving_district || centre.municipality || '')}</td></tr>
    <tr><th class="lbl">Transfer agreement number</th><td>${escapeHtml(s.transfer_agreement_number || '')}</td></tr>
    <tr><th class="lbl">Date transfer agreement signed</th><td>${escapeHtml(s.transfer_agreement_date || '')}</td></tr>
  </table>

  <h2>Summary</h2>
  <table>
    <tr><th class="lbl">Value of transfer agreement</th><td class="n">${agreementValue ? money(agreementValue) : ''}</td></tr>
    <tr><th class="lbl">Total transferred funds received</th><td class="n">${money(totalReceived)}</td></tr>
    <tr><th class="lbl">Transfers still due</th><td class="n">${agreementValue ? money(Math.max(agreementValue - totalReceived, 0)) : ''}</td></tr>
    <tr><th class="lbl">Total transferred funds received</th><td class="n">${money(totalReceived)}</td></tr>
    <tr><th class="lbl">Total expenditures</th><td class="n">${money(totalExpenditure)}</td></tr>
    <tr><th class="lbl">Balance</th><td class="n">${money(balance)}</td></tr>
  </table>

  <h2>Reporting period</h2>
  <table>
    <tr><th>Monthly</th><td>Jan</td><td>Feb</td><td>Mrc</td><td>Apr</td></tr>
    <tr><th></th><td>May</td><td>Jun</td><td>Jul</td><td>Aug</td></tr>
    <tr><th></th><td>Sep</td><td>Oct</td><td>Nov</td><td>Dec</td></tr>
    <tr><th>Quarterly</th><td>1st Quarter</td><td>2nd Quarter</td><td>3rd Quarter</td><td>4th Quarter</td></tr>
    <tr><th>End-year</th><td>30-Apr</td><td>31-May</td><td>Other</td><td></td></tr>
  </table>
  <div class="note">Tick the period this statement covers. Financial year April ${year} to March ${year + 1}.</div>

  <table class="sign">
    <tr><th>Initial Here:</th><th>Organisation</th></tr>
    <tr><td>Department:</td><td></td></tr>
    <tr><td>Witness 1:</td><td>Witness 1:</td></tr>
    <tr><td>Witness 2:</td><td>Witness 2:</td></tr>
  </table>
</div>

<div class="sheet pagebreak">
  ${crest()}
  <h2>Income and Expenditure Statement</h2>
  <table>
    <tr><th>Date received</th><th>Department or institution</th><th>Was transfer made late?</th><th class="n">Amount</th><th>For official use only</th></tr>
    ${receivedRows.map((x: any) => `<tr><td>${escapeHtml(x.payment_date)}</td><td>${escapeHtml(s.reporting_department || 'Department of Education, Free State Province')}</td><td></td><td class="n">${money(x.amount)}</td><td></td></tr>`).join('')}
    ${blankRows(Math.max(4 - receivedRows.length, 1), 5)}
    <tr><th colspan="3">Total transferred funds received (A)</th><th class="n">${money(totalReceived)}</th><th></th></tr>
  </table>

  <h2>a) Personal Emoluments</h2>
  <table>
    <tr><th class="lbl">Item</th><th>Number</th><th class="n">Amount</th></tr>
    <tr><td>Full time staff</td><td class="n">${payRows.length}</td><td class="n">${money(totalEmoluments)}</td></tr>
    ${payRows.map((x: any) => `<tr><td style="padding-left:6mm">${escapeHtml(x.full_name)} — ${escapeHtml(x.job_title)}</td><td class="n">${Number(x.slips)} slip(s)</td><td class="n">${money(x.gross)}</td></tr>`).join('')}
    ${payRows.length ? '' : blankRows(3, 3)}
    <tr><td>Part time staff</td><td class="blank"></td><td class="blank"></td></tr>
    <tr><td>Other</td><td class="blank"></td><td class="blank"></td></tr>
  </table>

  <h2>b) Service delivery expenditure (list out every item and amount)</h2>
  <table><tr><th class="lbl">Item</th><th class="n">Amount</th></tr>${blankRows(5, 2)}</table>

  <h2>c) Other Goods and services (list out every item and amount)</h2>
  <table><tr><th class="lbl">Item</th><th class="n">Amount</th></tr>${blankRows(5, 2)}</table>

  <h2>d) Capital items below R7000</h2>
  <table><tr><th class="lbl">Item</th><th class="n">Amount</th></tr>${blankRows(3, 2)}</table>

  <h2>e) Capital items above R7001</h2>
  <table><tr><th class="lbl">Item</th><th class="n">Amount</th></tr>${blankRows(3, 2)}</table>

  <table style="margin-top:4mm">
    <tr><th class="lbl">Total expenditures (B)</th><td class="n">${money(totalExpenditure)}</td></tr>
    <tr><th class="lbl">Surplus/(Deficit) (A &minus; B)</th><td class="n">${money(balance)}</td></tr>
  </table>
  <h2>Notes</h2>
  <table><tr>${blankRows(3, 1)}</tr></table>
  <div class="note">Please report actual according to budget items stated in the agreement. Salary figures are the gross amounts on payslips issued for April ${year} to March ${year + 1}.</div>

  <table class="sign">
    <tr><th>Initial Here:</th><th>Organisation</th></tr>
    <tr><td>Department:</td><td></td></tr>
    <tr><td>Witness 1:</td><td>Witness 1:</td></tr>
    <tr><td>Witness 2:</td><td>Witness 2:</td></tr>
  </table>
</div>
</body></html>`;
  return html(c, body);
});

export default r;
