import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { getCentreId } from '../tenant';

const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'admin';

// ── PAYSLIPS (admin-only, enforced by global guard) ─────────────
r.get('/payslips', async (c) => {
  const centre = getCentreId(c);
  const month = c.req.query('month');
  const year = c.req.query('year');
  let q = 'SELECT * FROM payslips WHERE centre_id = ?';
  const p: any[] = [centre];
  if (month && year) {
    q += ' AND pay_period_month = ? AND pay_period_year = ?';
    p.push(parseInt(month), parseInt(year));
  }
  const rows = await c.env.DB.prepare(q).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/payslips', async (c) => {
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  await c.env.DB.prepare(
    `INSERT INTO payslips (payslip_id, staff_id, pay_period_month, pay_period_year, gross_pay, total_deductions, net_pay, status, prepared_by, centre_id, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', 'Admin', ?, datetime('now'))`,
  ).bind(id, d.staff_id, d.pay_period_month, d.pay_period_year, d.gross_pay, d.total_deductions, d.net_pay, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'generated', module_name: 'payslips', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { payslip_id: id } });
});

r.post('/payslips/:id/email', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare("UPDATE payslips SET status = 'emailed' WHERE payslip_id = ? AND centre_id = ?").bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'emailed', module_name: 'payslips', record_id: id, metadata: '{}' });
  return c.json({ ok: true, data: { status: 'emailed' } });
});

r.post('/payslips/:id/paid', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare("UPDATE payslips SET status = 'paid' WHERE payslip_id = ? AND centre_id = ?").bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'marked_paid', module_name: 'payslips', record_id: id, metadata: '{}' });
  return c.json({ ok: true, data: { status: 'paid' } });
});

// ── FEES ────────────────────────────────────────────────────────
r.get('/fees/schedules', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM fee_schedules WHERE active = 1 AND centre_id = ? ORDER BY monthly_fee ASC').bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/fees/schedules', async (c) => {
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO fee_schedules (schedule_id, age_group, monthly_fee, description, centre_id) VALUES (?, ?, ?, ?, ?)').bind(id, d.age_group, d.monthly_fee, d.description || null, centre).run();
  return c.json({ ok: true, data: { id } });
});

r.get('/fees/records', async (c) => {
  const centre = getCentreId(c);
  const month = c.req.query('month');
  const year = c.req.query('year');
  let sql = 'SELECT f.*, c.full_name AS child_name FROM fee_records f JOIN children c ON f.child_id = c.child_id AND c.centre_id = f.centre_id WHERE f.centre_id = ?';
  const p: any[] = [centre];
  if (month && year) {
    sql += ' AND f.month = ? AND f.year = ?';
    p.push(parseInt(month), parseInt(year));
  }
  sql += ' ORDER BY f.year DESC, f.month DESC, c.full_name ASC';
  const rows = await c.env.DB.prepare(sql).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/fees/records', async (c) => {
  const d = (await c.req.json().catch(() => ({}))) as any;
  if (!d.child_id) return c.json({ ok: false, error: 'child_id is required.' }, 400);
  const centre = getCentreId(c);
  // Guard: the child must belong to this centre before we attach a fee record to it.
  const child = await c.env.DB.prepare('SELECT child_id FROM children WHERE child_id = ? AND centre_id = ?').bind(d.child_id, centre).first();
  if (!child) return c.json({ ok: false, error: 'Child not found' }, 404);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO fee_records (fee_id, child_id, schedule_id, month, year, amount_due, amount_paid, payment_method, payment_date, status, notes, centre_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, d.child_id, d.schedule_id || null, d.month, d.year, d.amount_due, d.amount_paid || 0, d.payment_method || null, d.payment_date || null, d.status || 'pending', d.notes || null, centre).run();
  return c.json({ ok: true, data: { id } });
});

r.put('/fees/records/:id', async (c) => {
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.amount_paid !== undefined) { fields.push('amount_paid = ?'); vals.push(d.amount_paid); }
  if (d.payment_method !== undefined) { fields.push('payment_method = ?'); vals.push(d.payment_method); }
  if (d.payment_date !== undefined) { fields.push('payment_date = ?'); vals.push(d.payment_date); }
  if (d.status !== undefined) { fields.push('status = ?'); vals.push(d.status); }
  if (d.notes !== undefined) { fields.push('notes = ?'); vals.push(d.notes); }
  if (!fields.length) return c.json({ ok: false, error: 'No fields' }, 400);
  vals.push(c.req.param('id'), centre);
  await c.env.DB.prepare(`UPDATE fee_records SET ${fields.join(', ')} WHERE fee_id = ? AND centre_id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

export default r;
