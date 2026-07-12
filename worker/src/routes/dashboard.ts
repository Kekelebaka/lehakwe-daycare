import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';

const r = new Hono<AppEnv>();

// GET /api/dashboard
r.get('/dashboard', async (c) => {
  const db = initDb(c.env.DB);
  const staffCount = await db.getAllStaff().then((s) => s.length);
  const childrenRow = await db.DB.prepare('SELECT COUNT(*) as count FROM children').first<{ count: number }>();
  const newInbox = await db.getAllThreads().then((t) => t.filter((x) => x.status === 'new').length);
  return c.json({ ok: true, data: { staffCount, childrenCount: childrenRow?.count ?? 0, newInbox, payrollStatus: 'pending' } });
});

export default r;
