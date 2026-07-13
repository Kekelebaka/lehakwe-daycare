import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getCentreId } from '../tenant';

const r = new Hono<AppEnv>();

// Confirm a child belongs to this centre before attaching care records to it.
async function childInCentre(c: any, childId: string, centre: string): Promise<boolean> {
  if (!childId) return false;
  const row = await c.env.DB.prepare('SELECT 1 AS ok FROM children WHERE child_id = ? AND centre_id = ?').bind(childId, centre).first();
  return !!row;
}

// ── ATTENDANCE ──────────────────────────────────────────────────
r.get('/attendance/summary', async (c) => {
  const centre = getCentreId(c);
  const month = parseInt(c.req.query('month') || String(new Date().getMonth() + 1));
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()));
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  const rows = await c.env.DB.prepare(
    `SELECT c.child_id, c.full_name,
       COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS days_present,
       COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS days_absent,
       COUNT(CASE WHEN a.status = 'late' THEN 1 END) AS days_late,
       COUNT(a.id) AS total_records
     FROM children c
     LEFT JOIN attendance_records a ON c.child_id = a.child_id AND a.centre_id = c.centre_id AND a.date >= ? AND a.date < ?
     WHERE c.status = 'active' AND c.centre_id = ?
     GROUP BY c.child_id
     ORDER BY c.full_name ASC`,
  ).bind(startDate, endDate, centre).all();
  return c.json({ ok: true, data: rows.results });
});

r.get('/attendance', async (c) => {
  const centre = getCentreId(c);
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10);
  const rows = await c.env.DB.prepare(
    `SELECT a.*, c.full_name AS child_name FROM attendance_records a JOIN children c ON a.child_id = c.child_id AND c.centre_id = a.centre_id WHERE a.date = ? AND a.centre_id = ? ORDER BY c.full_name ASC`,
  ).bind(date, centre).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/attendance', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.date) return c.json({ ok: false, error: 'child_id and date are required.' }, 400);
  const centre = getCentreId(c);
  if (!(await childInCentre(c, b.child_id, centre))) return c.json({ ok: false, error: 'Child not found' }, 404);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO attendance_records (id, child_id, date, check_in_time, check_out_time, status, absence_reason, recorded_by, centre_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.date, b.check_in_time || null, b.check_out_time || null, b.status || 'present', b.absence_reason || null, b.recorded_by || null, centre).run();
  return c.json({ ok: true, data: { id } });
});

r.put('/attendance/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const fields: string[] = [];
  const vals: any[] = [];
  if (b.check_in_time !== undefined) { fields.push('check_in_time = ?'); vals.push(b.check_in_time); }
  if (b.check_out_time !== undefined) { fields.push('check_out_time = ?'); vals.push(b.check_out_time); }
  if (b.status !== undefined) { fields.push('status = ?'); vals.push(b.status); }
  if (b.absence_reason !== undefined) { fields.push('absence_reason = ?'); vals.push(b.absence_reason); }
  if (!fields.length) return c.json({ ok: false, error: 'No fields to update' }, 400);
  vals.push(c.req.param('id'), centre);
  await c.env.DB.prepare(`UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ? AND centre_id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

// ── DAILY LOGS ──────────────────────────────────────────────────
r.get('/daily-logs', async (c) => {
  const centre = getCentreId(c);
  const date = c.req.query('date');
  const childId = c.req.query('child_id');
  let query = `SELECT dl.*, c.full_name as child_name, s.full_name as staff_name
               FROM daily_logs dl
               LEFT JOIN children c ON dl.child_id = c.child_id
               LEFT JOIN staff s ON dl.staff_id = s.staff_id WHERE dl.centre_id = ?`;
  const p: any[] = [centre];
  if (date) { query += ' AND dl.log_date = ?'; p.push(date); }
  if (childId) { query += ' AND dl.child_id = ?'; p.push(childId); }
  query += ' ORDER BY dl.created_at DESC';
  const rows = await c.env.DB.prepare(query).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/daily-logs', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.log_date || !b.activity_type || !b.description) return c.json({ ok: false, error: 'child_id, log_date, activity_type and description are required.' }, 400);
  const centre = getCentreId(c);
  if (!(await childInCentre(c, b.child_id, centre))) return c.json({ ok: false, error: 'Child not found' }, 404);
  const id = `log-${Date.now()}`;
  await c.env.DB.prepare(
    `INSERT INTO daily_logs (log_id, child_id, staff_id, log_date, activity_type, description, mood, notes, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.staff_id || 'system', b.log_date, b.activity_type, b.description, b.mood || null, b.notes || null, centre).run();
  return c.json({ ok: true, data: { log_id: id } });
});

r.delete('/daily-logs/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM daily_logs WHERE log_id = ? AND centre_id = ?').bind(c.req.param('id'), getCentreId(c)).run();
  return c.json({ ok: true });
});

// ── MILESTONES ──────────────────────────────────────────────────
r.get('/milestones', async (c) => {
  const centre = getCentreId(c);
  const childId = c.req.query('child_id');
  let sql = 'SELECT m.*, c.full_name AS child_name FROM developmental_milestones m JOIN children c ON m.child_id = c.child_id AND c.centre_id = m.centre_id WHERE m.centre_id = ?';
  const p: any[] = [centre];
  if (childId) { sql += ' AND m.child_id = ?'; p.push(childId); }
  sql += ' ORDER BY c.full_name, m.milestone_type';
  const rows = await c.env.DB.prepare(sql).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/milestones', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.milestone_type) return c.json({ ok: false, error: 'child_id and milestone_type are required.' }, 400);
  const centre = getCentreId(c);
  if (!(await childInCentre(c, b.child_id, centre))) return c.json({ ok: false, error: 'Child not found' }, 404);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO developmental_milestones (milestone_id, child_id, milestone_type, status, achieved_date, notes, assessed_by, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.milestone_type, b.status || 'pending', b.achieved_date || null, b.notes || null, b.assessed_by || null, centre).run();
  return c.json({ ok: true, data: { id } });
});

r.put('/milestones/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const fields: string[] = [];
  const vals: any[] = [];
  if (b.status !== undefined) { fields.push('status = ?'); vals.push(b.status); }
  if (b.achieved_date !== undefined) { fields.push('achieved_date = ?'); vals.push(b.achieved_date); }
  if (b.notes !== undefined) { fields.push('notes = ?'); vals.push(b.notes); }
  if (b.assessed_by !== undefined) { fields.push('assessed_by = ?'); vals.push(b.assessed_by); }
  if (!fields.length) return c.json({ ok: false, error: 'No fields' }, 400);
  vals.push(c.req.param('id'), centre);
  await c.env.DB.prepare(`UPDATE developmental_milestones SET ${fields.join(', ')} WHERE milestone_id = ? AND centre_id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

export default r;
