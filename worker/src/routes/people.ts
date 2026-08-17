import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { isAdmin, buildUpdate, blankToNull, type ColumnMap } from '../lib';
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
  ).bind(id, d.full_name, blankToNull(d.date_of_birth), blankToNull(d.age_group), blankToNull(d.enrolment_date), d.status || 'active', blankToNull(d.parent_id), blankToNull(d.emergency_contact_name), blankToNull(d.emergency_contact_phone), blankToNull(d.medical_notes), blankToNull(d.allergies), blankToNull(d.pickup_authorisation_notes), blankToNull(d.gender), blankToNull(d.race), blankToNull(d.disability), blankToNull(d.disability_description), blankToNull(d.income_category), blankToNull(d.id_number), centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'children', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { child_id: id } });
});

// Column whitelist for the partial update below. `notNull` marks columns the
// database refuses to blank, so an empty form field leaves them alone.
const CHILD_COLUMNS: ColumnMap = {
  full_name: { kind: 'text', notNull: true },
  date_of_birth: { kind: 'text' },
  age_group: { kind: 'text' },
  enrolment_date: { kind: 'text' },
  status: { kind: 'text', notNull: true },
  parent_id: { kind: 'text' },
  emergency_contact_name: { kind: 'text' },
  emergency_contact_phone: { kind: 'text' },
  medical_notes: { kind: 'text' },
  allergies: { kind: 'text' },
  pickup_authorisation_notes: { kind: 'text' },
  gender: { kind: 'text' },
  race: { kind: 'text' },
  disability: { kind: 'text' },
  disability_description: { kind: 'text' },
  income_category: { kind: 'text' },
  id_number: { kind: 'text' },
};

r.put('/children/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  if ('full_name' in d && !String(d.full_name ?? '').trim()) {
    return c.json({ ok: false, error: 'A child full name is required.' }, 400);
  }
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const { sets, values } = buildUpdate(CHILD_COLUMNS, d);
  if (!sets.length) return c.json({ ok: true });
  await c.env.DB.prepare(
    `UPDATE children SET ${sets.join(', ')}, updated_at = datetime('now') WHERE child_id = ? AND centre_id = ?`,
  ).bind(...values, id, centre).run();
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
  ).bind(id, d.full_name, blankToNull(d.phone), blankToNull(d.email), blankToNull(d.address), blankToNull(d.relationship_to_child), d.emergency_contact || 0, blankToNull(d.notes), centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'parents', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { parent_id: id } });
});

const PARENT_COLUMNS: ColumnMap = {
  full_name: { kind: 'text', notNull: true },
  phone: { kind: 'text' },
  email: { kind: 'text' },
  address: { kind: 'text' },
  relationship_to_child: { kind: 'text' },
  // INTEGER NOT NULL DEFAULT 0 in the schema — a flag, not a phone number.
  emergency_contact: { kind: 'bool', notNull: true },
  notes: { kind: 'text' },
};

r.put('/parents/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  if ('full_name' in d && !String(d.full_name ?? '').trim()) {
    return c.json({ ok: false, error: 'A parent full name is required.' }, 400);
  }
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const { sets, values } = buildUpdate(PARENT_COLUMNS, d);
  if (!sets.length) return c.json({ ok: true });
  await c.env.DB.prepare(
    `UPDATE parents SET ${sets.join(', ')}, updated_at = datetime('now') WHERE parent_id = ? AND centre_id = ?`,
  ).bind(...values, id, centre).run();
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
  ).bind(id, d.full_name, blankToNull(d.id_number), blankToNull(d.employee_number), d.job_title, blankToNull(d.email), blankToNull(d.phone), blankToNull(d.start_date), d.basic_salary || 0, d.uif_enabled ?? 1, d.paye_enabled ?? 0, d.active ?? 1, d.signature || '', blankToNull(d.emergency_contact_name), blankToNull(d.emergency_contact_phone), blankToNull(d.notes), blankToNull(d.gender), blankToNull(d.race), blankToNull(d.disability), blankToNull(d.disability_description), blankToNull(d.training_received), blankToNull(d.training_type), d.subsidised ?? 1, centre).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'created', module_name: 'staff', record_id: id, metadata: JSON.stringify(d) });
  return c.json({ ok: true, data: { staff_id: id } });
});

const STAFF_COLUMNS: ColumnMap = {
  full_name: { kind: 'text', notNull: true },
  id_number: { kind: 'text' },
  employee_number: { kind: 'text' },
  job_title: { kind: 'text', notNull: true },
  email: { kind: 'text' },
  phone: { kind: 'text' },
  start_date: { kind: 'text' },
  basic_salary: { kind: 'number', notNull: true },
  uif_enabled: { kind: 'bool', notNull: true },
  paye_enabled: { kind: 'bool', notNull: true },
  emergency_contact_name: { kind: 'text' },
  emergency_contact_phone: { kind: 'text' },
  notes: { kind: 'text' },
  signature: { kind: 'text' },
  gender: { kind: 'text' },
  race: { kind: 'text' },
  disability: { kind: 'text' },
  disability_description: { kind: 'text' },
  training_received: { kind: 'text' },
  training_type: { kind: 'text' },
  subsidised: { kind: 'bool', notNull: true },
};

r.put('/staff/:id', async (c) => {
  const id = c.req.param('id');
  const d = (await c.req.json().catch(() => ({}))) as any;
  if ('full_name' in d && !String(d.full_name ?? '').trim()) {
    return c.json({ ok: false, error: 'Full name is required.' }, 400);
  }
  if ('job_title' in d && !String(d.job_title ?? '').trim()) {
    return c.json({ ok: false, error: 'Job title is required.' }, 400);
  }
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const { sets, values } = buildUpdate(STAFF_COLUMNS, d);
  if (!sets.length) return c.json({ ok: true });
  await c.env.DB.prepare(
    `UPDATE staff SET ${sets.join(', ')}, updated_at = datetime('now') WHERE staff_id = ? AND centre_id = ?`,
  ).bind(...values, id, centre).run();
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
