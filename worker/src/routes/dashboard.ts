import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { getCentreId } from '../tenant';

const r = new Hono<AppEnv>();

// GET /api/dashboard
r.get('/dashboard', async (c) => {
  const centre = getCentreId(c);
  const db = initDb(c.env.DB, centre);
  const staffCount = await db.getAllStaff().then((s) => s.length);
  const childrenRow = await db.DB.prepare('SELECT COUNT(*) as count FROM children WHERE centre_id = ?').bind(centre).first<{ count: number }>();
  const newInbox = await db.getAllThreads().then((t) => t.filter((x) => x.status === 'new').length);
  return c.json({ ok: true, data: { staffCount, childrenCount: childrenRow?.count ?? 0, newInbox, payrollStatus: 'pending' } });
});

export default r;
