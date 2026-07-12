import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { enqueue, dispatchPending } from '../notifications';

const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'system';

// POST /api/media — staff upload a child's photo (multipart: file, child_id, [caption], [daily_log_id])
r.post('/media', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ ok: false, error: 'multipart/form-data required' }, 400);
  const file = form.get('file') as unknown as File | null;
  const childId = String(form.get('child_id') || '');
  if (!childId || !file || typeof file.stream !== 'function') return c.json({ ok: false, error: 'file and child_id are required' }, 400);
  const type = file.type || 'application/octet-stream';
  if (!type.startsWith('image/')) return c.json({ ok: false, error: 'Only image uploads are allowed' }, 400);
  if (file.size > 8 * 1024 * 1024) return c.json({ ok: false, error: 'Image too large (max 8MB)' }, 400);

  const db = initDb(c.env.DB);
  const id = db.uuid();
  const ext = (type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const key = `media/${childId}/${id}.${ext}`;
  await c.env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: type } });
  await c.env.DB.prepare(
    `INSERT INTO media (media_id, child_id, daily_log_id, r2_key, content_type, caption, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, childId, String(form.get('daily_log_id') || '') || null, key, type, String(form.get('caption') || '') || null, uid(c)).run();
  await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'uploaded', module_name: 'media', record_id: id, metadata: JSON.stringify({ child_id: childId }) });

  // Notify the parent that a new photo is available (best-effort, deduped per photo).
  try {
    const child = await c.env.DB.prepare('SELECT parent_id, full_name FROM children WHERE child_id = ?').bind(childId).first<any>();
    if (child?.parent_id) {
      const cap = String(form.get('caption') || '');
      await enqueue(c.env, {
        parentId: child.parent_id, childId,
        type: 'photo',
        title: `New photo of ${child.full_name}`,
        body: `${child.full_name}'s teachers added a new photo${cap ? `: "${cap}"` : ''}. Open your parent app to see it.`,
        dedupeKey: `photo:${id}`,
      });
      try { c.executionCtx.waitUntil(dispatchPending(c.env)); } catch { await dispatchPending(c.env); }
    }
  } catch { /* notifications are best-effort */ }

  return c.json({ ok: true, data: { media_id: id } });
});

// GET /api/media?child_id=xxx — staff list a child's media (metadata only)
r.get('/media', async (c) => {
  const childId = c.req.query('child_id');
  let sql = 'SELECT media_id, child_id, daily_log_id, content_type, caption, uploaded_by, created_at FROM media';
  const p: any[] = [];
  if (childId) { sql += ' WHERE child_id = ?'; p.push(childId); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = p.length ? await c.env.DB.prepare(sql).bind(...p).all() : await c.env.DB.prepare(sql).all();
  return c.json({ ok: true, data: rows.results });
});

// GET /api/media/:id — staff stream the image from R2 (cookie sent automatically by <img>)
r.get('/media/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT r2_key, content_type FROM media WHERE media_id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ ok: false, error: 'Not found' }, 404);
  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return c.json({ ok: false, error: 'Not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': row.content_type || 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } });
});

// DELETE /api/media/:id — staff remove a photo (R2 object + row)
r.delete('/media/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT r2_key FROM media WHERE media_id = ?').bind(id).first<any>();
  if (row) {
    try { await c.env.MEDIA.delete(row.r2_key); } catch { /* ignore */ }
    await c.env.DB.prepare('DELETE FROM media WHERE media_id = ?').bind(id).run();
    const db = initDb(c.env.DB);
    await db.insertAudit({ id: db.uuid(), user_id: uid(c), action: 'deleted', module_name: 'media', record_id: id, metadata: '{}' });
  }
  return c.json({ ok: true });
});

export default r;
