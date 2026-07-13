import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { getCentreId } from '../tenant';

const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'admin';

// ── SETTINGS (per-centre; composite key centre_id + setting_key) ─
r.get('/settings', async (c) => {
  const rows = await c.env.DB.prepare('SELECT setting_key, setting_value FROM settings WHERE centre_id = ?').bind(getCentreId(c)).all();
  const obj: Record<string, string> = {};
  for (const row of rows.results as any[]) obj[row.setting_key] = row.setting_value;
  return c.json({ ok: true, data: obj });
});
r.put('/settings', async (c) => {
  const centre = getCentreId(c);
  const { settings } = (await c.req.json().catch(() => ({ settings: {} }))) as { settings: Record<string, string> };
  const db = initDb(c.env.DB, centre);
  const stmt = c.env.DB.prepare(
    `INSERT INTO settings (centre_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(centre_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')`,
  );
  const batch = Object.entries(settings).map(([k, v]) => stmt.bind(centre, k, v));
  if (batch.length) await c.env.DB.batch(batch);
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'updated', module_name: 'settings', record_id: 'bulk', metadata: JSON.stringify({ keys: Object.keys(settings) }) });
  return c.json({ ok: true });
});

// ── COMPLIANCE ──────────────────────────────────────────────────
r.get('/compliance', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM compliance_items WHERE centre_id = ? ORDER BY category ASC').bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});
// Ubuntu Compliance Score — overall + per-category readiness for inspections/funders.
r.get('/compliance/score', async (c) => {
  const rows = await c.env.DB.prepare('SELECT category, status FROM compliance_items WHERE centre_id = ?').bind(getCentreId(c)).all<any>();
  const items = rows.results;
  const total = items.length;
  const complete = items.filter((i) => i.status === 'complete').length;
  const attention = items.filter((i) => i.status === 'needs_attention' || i.status === 'expired').length;
  const score = total ? Math.round((complete / total) * 100) : 0;
  const byCat: Record<string, { complete: number; total: number }> = {};
  for (const i of items) { (byCat[i.category] ||= { complete: 0, total: 0 }).total++; if (i.status === 'complete') byCat[i.category].complete++; }
  const categories = Object.entries(byCat).map(([category, v]) => ({ category, complete: v.complete, total: v.total, score: Math.round((v.complete / v.total) * 100) }));
  return c.json({ ok: true, data: { score, complete, attention, total, categories } });
});
r.put('/compliance/:id', async (c) => {
  const { status, notes } = (await c.req.json().catch(() => ({}))) as { status: string; notes?: string };
  await c.env.DB.prepare("UPDATE compliance_items SET status = ?, notes = ?, updated_at = datetime('now') WHERE compliance_id = ? AND centre_id = ?").bind(status, notes || null, c.req.param('id'), getCentreId(c)).run();
  return c.json({ ok: true });
});

// ── DOCUMENTS ───────────────────────────────────────────────────
r.get('/documents', async (c) => {
  const entityType = c.req.query('related_entity_type');
  const entityId = c.req.query('related_entity_id');
  let query = 'SELECT * FROM documents WHERE centre_id = ?';
  const p: any[] = [getCentreId(c)];
  if (entityType && entityId) { query += ' AND related_entity_type = ? AND related_entity_id = ?'; p.push(entityType, entityId); }
  else if (entityType) { query += ' AND related_entity_type = ?'; p.push(entityType); }
  query += ' ORDER BY uploaded_at DESC';
  const rows = await c.env.DB.prepare(query).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});
r.post('/documents', async (c) => {
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  await c.env.DB.prepare(
    `INSERT INTO documents (document_id, related_entity_type, related_entity_id, document_type, title, expiry_date, file_url, status, uploaded_by, centre_id, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(id, d.related_entity_type, d.related_entity_id, d.document_type, d.title, d.expiry_date || null, d.file_url || null, d.status || 'active', d.uploaded_by || null, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'documents', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { document_id: id } });
});
r.delete('/documents/:id', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const row = await c.env.DB.prepare('SELECT file_url FROM documents WHERE document_id = ? AND centre_id = ?').bind(id, centre).first<any>();
  if (row && row.file_url && String(row.file_url).startsWith('documents/')) { try { await c.env.MEDIA.delete(row.file_url); } catch { /* ignore */ } }
  await c.env.DB.prepare('DELETE FROM documents WHERE document_id = ? AND centre_id = ?').bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deleted', module_name: 'documents', record_id: id, metadata: '{}' });
  return c.json({ ok: true });
});

// Document vault — real file upload to R2 (documents/ prefix in the MEDIA bucket).
r.post('/documents/upload', async (c) => {
  const centre = getCentreId(c);
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ ok: false, error: 'multipart/form-data required' }, 400);
  const file = form.get('file') as unknown as File | null;
  if (!file || typeof file.stream !== 'function') return c.json({ ok: false, error: 'A file is required' }, 400);
  const type = file.type || 'application/octet-stream';
  const okType = type.startsWith('image/') || type === 'application/pdf' || type.includes('word') || type.includes('officedocument') || type === 'text/plain';
  if (!okType) return c.json({ ok: false, error: 'Allowed: PDF, image, Word or text' }, 400);
  if (file.size > 15 * 1024 * 1024) return c.json({ ok: false, error: 'File too large (max 15MB)' }, 400);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  const ext = type === 'application/pdf' ? 'pdf' : type === 'text/plain' ? 'txt' : type.startsWith('image/') ? (type.split('/')[1] || 'img').replace(/[^a-z0-9]/gi, '') : 'bin';
  const key = `documents/${centre}/${id}.${ext}`;
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });
  const expiry = String(form.get('expiry_date') || '') || null;
  const status = expiry && new Date(expiry) < new Date() ? 'expired' : 'active';
  await c.env.DB.prepare(
    `INSERT INTO documents (document_id, related_entity_type, related_entity_id, document_type, title, expiry_date, file_url, status, uploaded_by, centre_id, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(id, String(form.get('related_entity_type') || 'centre'), String(form.get('related_entity_id') || ''), String(form.get('document_type') || 'Other'), String(form.get('title') || file.name || 'Document'), expiry, key, status, uid(c), centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'uploaded', module_name: 'documents', record_id: id, metadata: JSON.stringify({ type }) });
  return c.json({ ok: true, data: { document_id: id } });
});

// Stream a stored document (staff-auth via global middleware). R2 key → stream; legacy URL → redirect.
r.get('/documents/:id/file', async (c) => {
  const row = await c.env.DB.prepare('SELECT file_url FROM documents WHERE document_id = ? AND centre_id = ?').bind(c.req.param('id'), getCentreId(c)).first<any>();
  if (!row || !row.file_url) return c.json({ ok: false, error: 'Not found' }, 404);
  if (!String(row.file_url).startsWith('documents/')) return c.redirect(row.file_url, 302);
  const obj = await c.env.MEDIA.get(row.file_url);
  if (!obj) return c.json({ ok: false, error: 'Not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'private, max-age=300' } });
});

// ── WAITLIST ────────────────────────────────────────────────────
r.get('/waitlist', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM waitlist WHERE centre_id = ? ORDER BY position ASC, created_at ASC').bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});
r.post('/waitlist', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.child_name) return c.json({ ok: false, error: 'child_name is required.' }, 400);
  const centre = getCentreId(c);
  const id = crypto.randomUUID();
  const maxPos = await c.env.DB.prepare('SELECT MAX(position) AS max_pos FROM waitlist WHERE centre_id = ?').bind(centre).first<{ max_pos: number }>();
  const position = (maxPos?.max_pos || 0) + 1;
  await c.env.DB.prepare(
    `INSERT INTO waitlist (waitlist_id, child_name, parent_name, parent_phone, parent_email, age_group, preferred_start_date, status, notes, position, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.child_name, b.parent_name || null, b.parent_phone || null, b.parent_email || null, b.age_group || null, b.preferred_start_date || null, b.status || 'waiting', b.notes || null, position, centre).run();
  return c.json({ ok: true, data: { id, position } });
});
r.put('/waitlist/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const f: string[] = [];
  const v: any[] = [];
  if (b.status !== undefined) { f.push('status = ?'); v.push(b.status); }
  if (b.position !== undefined) { f.push('position = ?'); v.push(b.position); }
  if (b.notes !== undefined) { f.push('notes = ?'); v.push(b.notes); }
  f.push("updated_at = datetime('now')");
  if (f.length === 1) return c.json({ ok: false, error: 'No fields' }, 400);
  v.push(c.req.param('id'), getCentreId(c));
  await c.env.DB.prepare(`UPDATE waitlist SET ${f.join(', ')} WHERE waitlist_id = ? AND centre_id = ?`).bind(...v).run();
  return c.json({ ok: true });
});
r.delete('/waitlist/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM waitlist WHERE waitlist_id = ? AND centre_id = ?').bind(c.req.param('id'), getCentreId(c)).run();
  return c.json({ ok: true });
});

// ── LEAVE ───────────────────────────────────────────────────────
r.get('/leave', async (c) => {
  const centre = getCentreId(c);
  const status = c.req.query('status');
  const staffId = c.req.query('staff_id');
  let query = 'SELECT lr.*, s.full_name AS staff_name FROM leave_requests lr LEFT JOIN staff s ON lr.staff_id = s.staff_id WHERE lr.centre_id = ?';
  const p: any[] = [centre];
  if (status) { query += ' AND lr.status = ?'; p.push(status); }
  if (staffId) { query += ' AND lr.staff_id = ?'; p.push(staffId); }
  query += ' ORDER BY lr.created_at DESC';
  const rows = await c.env.DB.prepare(query).bind(...p).all();
  return c.json({ ok: true, data: rows.results });
});
r.post('/leave', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.staff_id || !b.leave_type || !b.start_date || !b.end_date) return c.json({ ok: false, error: 'staff_id, leave_type, start_date and end_date are required.' }, 400);
  const centre = getCentreId(c);
  const staff = await c.env.DB.prepare('SELECT staff_id FROM staff WHERE staff_id = ? AND centre_id = ?').bind(b.staff_id, centre).first();
  if (!staff) return c.json({ ok: false, error: 'Staff not found' }, 404);
  const db = initDb(c.env.DB, centre);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO leave_requests (leave_id, staff_id, leave_type, start_date, end_date, reason, status, centre_id) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).bind(id, b.staff_id, b.leave_type, b.start_date, b.end_date, b.reason || null, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'leave_requests', record_id: id, metadata: JSON.stringify(b) });
  return c.json({ ok: true, data: { leave_id: id } });
});
r.put('/leave/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const f: string[] = [];
  const v: any[] = [];
  if (b.status !== undefined) { f.push('status = ?'); v.push(b.status); }
  if (b.approved_by !== undefined) { f.push('approved_by = ?'); v.push(b.approved_by); }
  if (b.reason !== undefined) { f.push('reason = ?'); v.push(b.reason); }
  if (!f.length) return c.json({ ok: false, error: 'No fields to update' }, 400);
  v.push(c.req.param('id'), centre);
  await c.env.DB.prepare(`UPDATE leave_requests SET ${f.join(', ')} WHERE leave_id = ? AND centre_id = ?`).bind(...v).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'updated', module_name: 'leave_requests', record_id: c.req.param('id'), metadata: JSON.stringify(b) });
  return c.json({ ok: true });
});
r.delete('/leave/:id', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare('DELETE FROM leave_requests WHERE leave_id = ? AND centre_id = ?').bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deleted', module_name: 'leave_requests', record_id: id, metadata: '{}' });
  return c.json({ ok: true });
});

// ── TOWN ────────────────────────────────────────────────────────
r.get('/town/config', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM town_config WHERE active = 1').all();
  return c.json({ ok: true, data: rows.results });
});
r.get('/town/stats', async (c) => {
  const centre = getCentreId(c);
  const [children, staff, centres] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM children WHERE status = 'active' AND centre_id = ?").bind(centre).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM staff WHERE active = 1 AND centre_id = ?').bind(centre).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM town_config WHERE active = 1').first<{ count: number }>(),
  ]);
  return c.json({ ok: true, data: { total_children: children?.count || 0, total_staff: staff?.count || 0, total_centres: centres?.count || 0, town: 'Bloemfontein', coordinator: 'Keke Lebaka' } });
});

export default r;
