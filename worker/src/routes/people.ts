import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { isAdmin } from '../lib';
import { getCentreId } from '../tenant';

const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'admin';

// ── CHILDREN ────────────────────────────────────────────────────
const ChildCreate = z.object({
  full_name: z.string().min(1),
  date_of_birth: z.string().optional(), age_group: z.string().optional(), enrolment_date: z.string().optional(),
  status: z.string().optional(), parent_id: z.string().optional(),
  emergency_contact_name: z.string().optional(), emergency_contact_phone: z.string().optional(),
  medical_notes: z.string().optional(), allergies: z.string().optional(), pickup_authorisation_notes: z.string().optional(),
  gender: z.string().optional(), race: z.string().optional(), disability: z.string().optional(),
  disability_description: z.string().optional(), income_category: z.string().optional(), id_number: z.string().optional(),
}).passthrough();

r.get('/children', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM children WHERE centre_id = ? ORDER BY full_name ASC').bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/children', async (c) => {
  const parsed = ChildCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'A child full name is required.' }, 400);
  const d = parsed.data as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  await c.env.DB.prepare(
    `INSERT INTO children (child_id, full_name, date_of_birth, age_group, enrolment_date, status, parent_id, emergency_contact_name, emergency_contact_phone, medical_notes, allergies, pickup_authorisation_notes, gender, race, disability, disability_description, income_category, id_number, centre_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).bind(id, d.full_name, d.date_of_birth || null, d.age_group || null, d.enrolment_date || null, d.status || 'active', d.parent_id || null, d.emergency_contact_name || null, d.emergency_contact_phone || null, d.medical_notes || null, d.allergies || null, d.pickup_authorisation_notes || null, d.gender || null, d.race || null, d.disability || null, d.disability_description || null, d.income_category || null, d.id_number || null, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'children', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { child_id: id } });
});

r.put('/children/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare(
    `UPDATE children SET full_name = COALESCE(?, full_name), date_of_birth = COALESCE(?, date_of_birth), age_group = COALESCE(?, age_group), enrolment_date = COALESCE(?, enrolment_date), status = COALESCE(?, status), parent_id = COALESCE(?, parent_id), emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_phone = COALESCE(?, emergency_contact_phone), medical_notes = COALESCE(?, medical_notes), allergies = COALESCE(?, allergies), pickup_authorisation_notes = COALESCE(?, pickup_authorisation_notes), gender = COALESCE(?, gender), race = COALESCE(?, race), disability = COALESCE(?, disability), disability_description = COALESCE(?, disability_description), income_category = COALESCE(?, income_category), id_number = COALESCE(?, id_number), updated_at = datetime('now') WHERE child_id = ? AND centre_id = ?`,
  ).bind(d.full_name ?? null, d.date_of_birth ?? null, d.age_group ?? null, d.enrolment_date ?? null, d.status ?? null, d.parent_id ?? null, d.emergency_contact_name ?? null, d.emergency_contact_phone ?? null, d.medical_notes ?? null, d.allergies ?? null, d.pickup_authorisation_notes ?? null, d.gender ?? null, d.race ?? null, d.disability ?? null, d.disability_description ?? null, d.income_category ?? null, d.id_number ?? null, id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'updated', module_name: 'children', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true });
});

r.delete('/children/:id', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare('DELETE FROM children WHERE child_id = ? AND centre_id = ?').bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deleted', module_name: 'children', record_id: id, metadata: '{}' });
  return c.json({ ok: true });
});

// ── PARENTS ─────────────────────────────────────────────────────
const ParentCreate = z.object({ full_name: z.string().min(1) }).passthrough();

r.get('/parents', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM parents WHERE centre_id = ? ORDER BY full_name ASC').bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});

r.post('/parents', async (c) => {
  const parsed = ParentCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'A parent full name is required.' }, 400);
  const d = parsed.data as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  await c.env.DB.prepare(
    `INSERT INTO parents (parent_id, full_name, phone, email, address, relationship_to_child, emergency_contact, notes, centre_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).bind(id, d.full_name, d.phone || null, d.email || null, d.address || null, d.relationship_to_child || null, d.emergency_contact || 0, d.notes || null, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'parents', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { parent_id: id } });
});

r.put('/parents/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare(
    `UPDATE parents SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address), relationship_to_child = COALESCE(?, relationship_to_child), emergency_contact = COALESCE(?, emergency_contact), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE parent_id = ? AND centre_id = ?`,
  ).bind(d.full_name ?? null, d.phone ?? null, d.email ?? null, d.address ?? null, d.relationship_to_child ?? null, d.emergency_contact ?? null, d.notes ?? null, id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'updated', module_name: 'parents', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true });
});

r.delete('/parents/:id', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare('DELETE FROM parents WHERE parent_id = ? AND centre_id = ?').bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deleted', module_name: 'parents', record_id: id, metadata: '{}' });
  return c.json({ ok: true });
});

// ── STAFF ───────────────────────────────────────────────────────
const StaffCreate = z.object({ full_name: z.string().min(1), job_title: z.string().min(1) }).passthrough();

r.get('/staff', async (c) => {
  const db = initDb(c.env.DB, getCentreId(c));
  const staff = await db.getAllStaff();
  const privileged = isAdmin(c.get('identity')?.role);
  const data = privileged
    ? staff
    : staff.map((s: any) => ({ staff_id: s.staff_id, full_name: s.full_name, job_title: s.job_title, email: s.email, phone: s.phone, active: s.active }));
  return c.json({ ok: true, data });
});

r.post('/staff', async (c) => {
  const parsed = StaffCreate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Staff full name and job title are required.' }, 400);
  const d = parsed.data as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const id = db.uuid();
  await c.env.DB.prepare(
    `INSERT INTO staff (staff_id, full_name, id_number, employee_number, job_title, email, phone, start_date, basic_salary, uif_enabled, paye_enabled, active, signature, emergency_contact_name, emergency_contact_phone, notes, gender, race, disability, disability_description, training_received, training_type, subsidised, centre_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).bind(id, d.full_name, d.id_number || null, d.employee_number || null, d.job_title, d.email || null, d.phone || null, d.start_date || null, d.basic_salary || 0, d.uif_enabled ?? 1, d.paye_enabled ?? 0, d.active ?? 1, d.signature || '', d.emergency_contact_name || null, d.emergency_contact_phone || null, d.notes || null, d.gender || null, d.race || null, d.disability || null, d.disability_description || null, d.training_received || null, d.training_type || null, d.subsidised ?? 1, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'staff', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { staff_id: id } });
});

r.put('/staff/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare(
    `UPDATE staff SET full_name = COALESCE(?, full_name), id_number = COALESCE(?, id_number), employee_number = COALESCE(?, employee_number), job_title = COALESCE(?, job_title), email = COALESCE(?, email), phone = COALESCE(?, phone), start_date = COALESCE(?, start_date), basic_salary = COALESCE(?, basic_salary), uif_enabled = COALESCE(?, uif_enabled), paye_enabled = COALESCE(?, paye_enabled), emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_phone = COALESCE(?, emergency_contact_phone), notes = COALESCE(?, notes), gender = COALESCE(?, gender), race = COALESCE(?, race), disability = COALESCE(?, disability), disability_description = COALESCE(?, disability_description), training_received = COALESCE(?, training_received), training_type = COALESCE(?, training_type), subsidised = COALESCE(?, subsidised), updated_at = datetime('now') WHERE staff_id = ? AND centre_id = ?`,
  ).bind(d.full_name ?? null, d.id_number ?? null, d.employee_number ?? null, d.job_title ?? null, d.email ?? null, d.phone ?? null, d.start_date ?? null, d.basic_salary ?? null, d.uif_enabled ?? null, d.paye_enabled ?? null, d.emergency_contact_name ?? null, d.emergency_contact_phone ?? null, d.notes ?? null, d.gender ?? null, d.race ?? null, d.disability ?? null, d.disability_description ?? null, d.training_received ?? null, d.training_type ?? null, d.subsidised ?? null, id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'updated', module_name: 'staff', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true });
});

r.delete('/staff/:id', async (c) => {
  const id = c.req.param('id');
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  await c.env.DB.prepare("UPDATE staff SET active = 0, updated_at = datetime('now') WHERE staff_id = ? AND centre_id = ?").bind(id, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deactivated', module_name: 'staff', record_id: id, metadata: '{}' });
  return c.json({ ok: true });
});

export default r;
