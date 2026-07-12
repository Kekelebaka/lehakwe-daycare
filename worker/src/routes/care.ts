import { Hono } from 'hono';
import type { AppEnv } from '../env';

const r = new Hono<AppEnv>();

// ── ATTENDANCE ──────────────────────────────────────────────────
r.get('/attendance/summary', async (c) => {
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
       COUNT(*) AS total_records
     FROM children c
     LEFT JOIN attendance_records a ON c.child_id = a.child_id AND a.date >= ? AND a.date < ?
     WHERE c.status = 'active'
     GROUP BY c.child_id
     ORDER BY c.full_name ASC`,
  ).bind(startDate, endDate).all();
  return c.json({ ok: true, data: rows.results });
});

r.get('/attendance', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10);
  const rows = await c.env.DB.prepare(
    `SELECT a.*, c.full_name AS child_name FROM attendance_records a JOIN children c ON a.child_id = c.child_id WHERE a.date = ? ORDER BY c.full_name ASC`,
  ).bind(date).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/attendance', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.date) return c.json({ ok: false, error: 'child_id and date are required.' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO attendance_records (id, child_id, date, check_in_time, check_out_time, status, absence_reason, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.date, b.check_in_time || null, b.check_out_time || null, b.status || 'present', b.absence_reason || null, b.recorded_by || null).run();
  return c.json({ ok: true, data: { id } });
});

r.put('/attendance/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const fields: string[] = [];
  const vals: any[] = [];
  if (b.check_in_time !== undefined) { fields.push('check_in_time = ?'); vals.push(b.check_in_time); }
  if (b.check_out_time !== undefined) { fields.push('check_out_time = ?'); vals.push(b.check_out_time); }
  if (b.status !== undefined) { fields.push('status = ?'); vals.push(b.status); }
  if (b.absence_reason !== undefined) { fields.push('absence_reason = ?'); vals.push(b.absence_reason); }
  if (!fields.length) return c.json({ ok: false, error: 'No fields to update' }, 400);
  vals.push(c.req.param('id'));
  await c.env.DB.prepare(`UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

// ── DAILY LOGS ──────────────────────────────────────────────────
r.get('/daily-logs', async (c) => {
  const date = c.req.query('date');
  const childId = c.req.query('child_id');
  let query = `SELECT dl.*, c.full_name as child_name, s.full_name as staff_name
               FROM daily_logs dl
               LEFT JOIN children c ON dl.child_id = c.child_id
               LEFT JOIN staff s ON dl.staff_id = s.staff_id WHERE 1=1`;
  const p: any[] = [];
  if (date) { query += ' AND dl.log_date = ?'; p.push(date); }
  if (childId) { query += ' AND dl.child_id = ?'; p.push(childId); }
  query += ' ORDER BY dl.created_at DESC';
  const rows = p.length ? await c.env.DB.prepare(query).bind(...p).all() : await c.env.DB.prepare(query).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/daily-logs', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.log_date || !b.activity_type || !b.description) return c.json({ ok: false, error: 'child_id, log_date, activity_type and description are required.' }, 400);
  const id = `log-${Date.now()}`;
  await c.env.DB.prepare(
    `INSERT INTO daily_logs (log_id, child_id, staff_id, log_date, activity_type, description, mood, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.staff_id || 'system', b.log_date, b.activity_type, b.description, b.mood || null, b.notes || null).run();
  return c.json({ ok: true, data: { log_id: id } });
});

r.delete('/daily-logs/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM daily_logs WHERE log_id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── MILESTONES ──────────────────────────────────────────────────
r.get('/milestones', async (c) => {
  const childId = c.req.query('child_id');
  let sql = 'SELECT m.*, c.full_name AS child_name FROM developmental_milestones m JOIN children c ON m.child_id = c.child_id';
  const p: any[] = [];
  if (childId) { sql += ' WHERE m.child_id = ?'; p.push(childId); }
  sql += ' ORDER BY c.full_name, m.milestone_type';
  const rows = p.length ? await c.env.DB.prepare(sql).bind(...p).all() : await c.env.DB.prepare(sql).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/milestones', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_id || !b.milestone_type) return c.json({ ok: false, error: 'child_id and milestone_type are required.' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO developmental_milestones (milestone_id, child_id, milestone_type, status, achieved_date, notes, assessed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_id, b.milestone_type, b.status || 'pending', b.achieved_date || null, b.notes || null, b.assessed_by || null).run();
  return c.json({ ok: true, data: { id } });
});

r.put('/milestones/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const fields: string[] = [];
  const vals: any[] = [];
  if (b.status !== undefined) { fields.push('status = ?'); vals.push(b.status); }
  if (b.achieved_date !== undefined) { fields.push('achieved_date = ?'); vals.push(b.achieved_date); }
  if (b.notes !== undefined) { fields.push('notes = ?'); vals.push(b.notes); }
  if (b.assessed_by !== undefined) { fields.push('assessed_by = ?'); vals.push(b.assessed_by); }
  if (!fields.length) return c.json({ ok: false, error: 'No fields' }, 400);
  vals.push(c.req.param('id'));
  await c.env.DB.prepare(`UPDATE developmental_milestones SET ${fields.join(', ')} WHERE milestone_id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

export default r;
