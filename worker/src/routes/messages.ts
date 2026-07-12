import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { getOrCreateThread, markThreadRead, insertThreadMessage } from '../messaging';
import { enqueue, dispatchPending } from '../notifications';

// Staff side of parent↔staff messaging. Mounted under /api (protected by the
// global staff-auth middleware; NOT in the admin-only matrix, so teachers can
// message parents too). Parent-side endpoints live in routes/parent.ts.
const r = new Hono<AppEnv>();

const SendBody = z.object({ body: z.string().trim().min(1).max(4000) });

// GET /api/messages/threads — one row per active child, most-recent conversation
// first, with a last-message preview and count of unread parent messages.
r.get('/messages/threads', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT c.child_id, c.full_name AS child_name, c.parent_id,
            p.full_name AS parent_name,
            t.thread_id, t.last_message_at,
            (SELECT body FROM thread_messages WHERE thread_id = t.thread_id ORDER BY created_at DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM thread_messages WHERE thread_id = t.thread_id AND sender_type = 'parent' AND read_at IS NULL) AS unread
     FROM children c
     LEFT JOIN parents p ON c.parent_id = p.parent_id
     LEFT JOIN message_threads t ON t.child_id = c.child_id
     WHERE c.status = 'active'
     ORDER BY (t.last_message_at IS NULL), t.last_message_at DESC, c.full_name ASC`,
  ).all();
  return c.json({ ok: true, data: rows.results });
});

// GET /api/messages/thread/:childId — open (or lazily create) a child's thread,
// mark the parent's messages read, and return the full conversation.
r.get('/messages/thread/:childId', async (c) => {
  const childId = c.req.param('childId');
  const t = await getOrCreateThread(c.env.DB, childId);
  if (!t) return c.json({ ok: false, error: 'Child not found' }, 404);

  const child = await c.env.DB.prepare('SELECT child_id, full_name, parent_id FROM children WHERE child_id = ?').bind(childId).first<any>();
  const parent = child?.parent_id
    ? await c.env.DB.prepare('SELECT parent_id, full_name, email FROM parents WHERE parent_id = ?').bind(child.parent_id).first<any>()
    : null;

  await markThreadRead(c.env.DB, t.thread_id, 'staff');
  const msgs = await c.env.DB.prepare(
    'SELECT message_id, sender_type, sender_id, sender_name, body, read_at, created_at FROM thread_messages WHERE thread_id = ? ORDER BY created_at ASC',
  ).bind(t.thread_id).all();

  return c.json({ ok: true, data: { thread_id: t.thread_id, child, parent, messages: msgs.results } });
});

// POST /api/messages/thread/:childId — staff sends a message to the child's parent.
r.post('/messages/thread/:childId', async (c) => {
  const identity = c.get('identity');
  if (!identity) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  const parsed = SendBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ ok: false, error: 'Message cannot be empty.' }, 400);

  const childId = c.req.param('childId');
  const t = await getOrCreateThread(c.env.DB, childId);
  if (!t) return c.json({ ok: false, error: 'Child not found' }, 404);

  const msg = await insertThreadMessage(c.env.DB, t.thread_id, 'staff', identity.sub, identity.name || 'Staff', parsed.data.body);

  // Notify the parent out-of-app that a new message arrived (best-effort).
  try {
    const child = await c.env.DB.prepare('SELECT parent_id, full_name FROM children WHERE child_id = ?').bind(childId).first<any>();
    if (child?.parent_id) {
      const b = parsed.data.body;
      const preview = b.length > 140 ? `${b.slice(0, 140)}…` : b;
      await enqueue(c.env, {
        parentId: child.parent_id, childId,
        type: 'message',
        title: `New message about ${child.full_name}`,
        body: `${identity.name || 'The centre'}: "${preview}"`,
      });
      try { c.executionCtx.waitUntil(dispatchPending(c.env)); } catch { await dispatchPending(c.env); }
    }
  } catch { /* notifications are best-effort */ }

  return c.json({ ok: true, data: msg });
});

export default r;
