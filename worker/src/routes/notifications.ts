import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { enqueueFeeReminders, dispatchPending } from '../notifications';
import { getCentreId } from '../tenant';

// Admin-facing notification controls + delivery log. All routes are admin-gated
// via requiresAdmin() in lib.ts. The message/photo enqueue happens inside the
// existing message-send and photo-upload handlers, not here.
const r = new Hono<AppEnv>();

// GET /api/notifications — recent delivery log (newest first).
r.get('/notifications', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT n.notification_id, n.type, n.title, n.status, n.channel, n.attempts, n.last_error, n.created_at, n.sent_at,
            p.full_name AS parent_name, ch.full_name AS child_name
     FROM notifications n
     LEFT JOIN parents p ON n.parent_id = p.parent_id
     LEFT JOIN children ch ON n.child_id = ch.child_id
     WHERE n.centre_id = ?
     ORDER BY n.created_at DESC LIMIT 100`,
  ).bind(getCentreId(c)).all();
  return c.json({ ok: true, data: rows.results });
});

// POST /api/notifications/fee-reminders — enqueue reminders for outstanding balances,
// then kick off delivery immediately (best-effort; Cron is the retry safety-net).
r.post('/notifications/fee-reminders', async (c) => {
  const enqueued = await enqueueFeeReminders(c.env, getCentreId(c));
  try { c.executionCtx.waitUntil(dispatchPending(c.env)); } catch { await dispatchPending(c.env); }
  return c.json({ ok: true, data: { enqueued } });
});

// POST /api/notifications/dispatch — manually flush the outbox.
r.post('/notifications/dispatch', async (c) => {
  const stats = await dispatchPending(c.env);
  return c.json({ ok: true, data: stats });
});

export default r;
