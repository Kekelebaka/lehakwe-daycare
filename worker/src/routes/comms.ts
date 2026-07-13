import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initDb } from '../db';
import { sendEmailViaResend } from '../lib';

const r = new Hono<AppEnv>();
const uid = (c: any) => c.get('identity')?.sub || 'system';

// ── NOTICES ─────────────────────────────────────────────────────
r.get('/notices', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM notices ORDER BY pinned DESC, created_at DESC').all();
  return c.json({ ok: true, data: rows.results });
});
r.post('/notices', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  if (!b.title || !b.content) return c.json({ ok: false, error: 'title and content are required.' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO notices (notice_id, title, content, category, pinned, published, expires_at, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, b.title, b.content, b.category || 'general', b.pinned ? 1 : 0, b.published ? 1 : 0, b.expires_at || null, b.author_id || null).run();
  return c.json({ ok: true, data: { id } });
});
r.put('/notices/:id', async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as any;
  const f: string[] = [];
  const v: any[] = [];
  if (b.title !== undefined) { f.push('title = ?'); v.push(b.title); }
  if (b.content !== undefined) { f.push('content = ?'); v.push(b.content); }
  if (b.category !== undefined) { f.push('category = ?'); v.push(b.category); }
  if (b.pinned !== undefined) { f.push('pinned = ?'); v.push(b.pinned ? 1 : 0); }
  if (b.published !== undefined) { f.push('published = ?'); v.push(b.published ? 1 : 0); }
  if (b.expires_at !== undefined) { f.push('expires_at = ?'); v.push(b.expires_at); }
  f.push("updated_at = datetime('now')");
  if (f.length === 1) return c.json({ ok: false, error: 'No fields' }, 400);
  v.push(c.req.param('id'));
  await c.env.DB.prepare(`UPDATE notices SET ${f.join(', ')} WHERE notice_id = ?`).bind(...v).run();
  return c.json({ ok: true });
});
r.delete('/notices/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM notices WHERE notice_id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── INBOX ───────────────────────────────────────────────────────
r.get('/threads', async (c) => {
  const db = initDb(c.env.DB);
  return c.json({ ok: true, data: await db.getAllThreads() });
});
r.get('/threads/:id', async (c) => {
  const db = initDb(c.env.DB);
  const tid = c.req.param('id');
  const [messages, notes, auditLogs] = await Promise.all([db.getThread(tid), db.getNotes(tid), db.getAuditLogs(tid)]);
  return c.json({ ok: true, data: { thread_id: tid, messages, notes, audit_logs: auditLogs } });
});
r.put('/threads/:id/status', async (c) => {
  const db = initDb(c.env.DB);
  const tid = c.req.param('id');
  const { status, staff_id } = (await c.req.json().catch(() => ({}))) as any;
  await db.updateStatus(tid, status);
  await db.insertAudit({ id: db.uuid(), thread_id: tid, staff_id: staff_id || 'system', action: status === 'closed' ? 'closed' : 'assigned', metadata: JSON.stringify({ status }) });
  return c.json({ ok: true });
});
r.put('/threads/:id/assign', async (c) => {
  const db = initDb(c.env.DB);
  const tid = c.req.param('id');
  const { staff_id } = (await c.req.json().catch(() => ({}))) as any;
  await db.assignThread(tid, staff_id);
  await db.insertAudit({ id: db.uuid(), thread_id: tid, staff_id: staff_id || 'system', action: 'assigned', metadata: JSON.stringify({ staff_id }) });
  return c.json({ ok: true });
});

async function handleReply(c: any, threadIdFromPath?: string) {
  const body_raw = (await c.req.json().catch(() => ({}))) as any;
  const thread_id = body_raw.thread_id || threadIdFromPath || null;
  const staff_id = body_raw.staff_id || 'system';
  const replyBody = body_raw.body || '';
  const template_id = body_raw.template_id;
  if (!thread_id) return c.json({ ok: false, error: 'thread_id required' }, 400);

  const db = initDb(c.env.DB);
  const msgs = await db.getThread(thread_id);
  const original = msgs[0];
  if (!original) return c.json({ ok: false, error: 'Thread not found' }, 404);

  let finalBody = replyBody;
  if (template_id) {
    const tpl = await db.getTemplate(template_id);
    if (tpl) finalBody = tpl.body.replace('[SIGNATURE]', '');
  }
  await db.updateStatus(thread_id, 'replied');

  let staffSig = '';
  if (staff_id && staff_id !== 'system') {
    const s = await db.getStaff(staff_id);
    staffSig = s?.signature ? `\n\n${s.signature}` : '';
  }
  const emailText = `${finalBody}${staffSig}`;
  const subject = original.subject && original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
  const sent = await sendEmailViaResend(c.env, { to: original.from_email, fromName: 'Lehakwe Daycare', fromEmail: `info@${c.env.SENDING_DOMAIN}`, subject, text: emailText });

  await db.DB.prepare(
    `INSERT INTO email_replies (reply_id, thread_id, staff_id, body, sent_to, signature_used) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(db.uuid(), thread_id, staff_id === 'system' ? null : staff_id, emailText, original.from_email, staffSig || null).run();
  await db.insertAudit({ id: db.uuid(), thread_id, staff_id, action: 'replied', metadata: JSON.stringify({ body_length: finalBody.length, sent }) });

  return c.json({ ok: true, data: { message_id: db.uuid(), sent, note: sent ? 'Reply sent.' : 'Reply recorded. Set RESEND_API_KEY to enable email delivery.' } });
}
r.post('/threads/:id/reply', (c) => handleReply(c, c.req.param('id')));
r.post('/send', (c) => handleReply(c));

r.post('/notes', async (c) => {
  const { thread_id, staff_id, note } = (await c.req.json().catch(() => ({}))) as any;
  const db = initDb(c.env.DB);
  const noteId = db.uuid();
  await db.insertNote({ id: noteId, thread_id, staff_id, note });
  await db.insertAudit({ id: db.uuid(), thread_id, staff_id: staff_id || 'system', action: 'noted', metadata: '{}' });
  return c.json({ ok: true, data: { id: noteId } });
});
r.get('/templates', async (c) => {
  const db = initDb(c.env.DB);
  return c.json({ ok: true, data: await db.getTemplates() });
});
r.get('/audit', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
  return c.json({ ok: true, data: rows.results });
});

// ── AI ASSISTANT ────────────────────────────────────────────────
r.get('/ai/templates', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM ai_templates WHERE active = 1 ORDER BY category, name').all();
  return c.json({ ok: true, data: rows.results });
});
r.post('/ai/generate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any;
  const { template_id, variables, custom_prompt, language } = body;
  let prompt = '';
  if (template_id) {
    const tpl = await c.env.DB.prepare('SELECT * FROM ai_templates WHERE template_id = ?').bind(template_id).first();
    if (!tpl) return c.json({ ok: false, error: 'Template not found' }, 404);
    prompt = tpl.prompt_template as string;
    if (variables) {
      for (const [k, val] of Object.entries(variables)) prompt = prompt.replace(new RegExp(`\\{${k}\\}`, 'g'), val as string);
    }
  } else if (custom_prompt) {
    prompt = custom_prompt;
  } else {
    return c.json({ ok: false, error: 'Provide template_id or custom_prompt' }, 400);
  }
  const lang = language || 'en';
  const langMap: Record<string, string> = { en: 'English', st: 'Sesotho', tn: 'Setswana', af: 'Afrikaans', zu: 'isiZulu' };
  if (lang !== 'en') prompt = `Please write this in ${langMap[lang] || lang}. Keep the same meaning and tone.\n\n${prompt}`;
  const aiResponse = await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: 'You are a professional South African ECD (Early Childhood Development) assistant for Lehakwe Daycare (NPO 22910695). Write in a warm, professional tone. Use South African English conventions. Always include relevant NPO and contact details when writing letters.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
  });
  const output = (aiResponse as any).response || JSON.stringify(aiResponse);
  const docId = `doc-${Date.now()}`;
  let docType = 'custom';
  if (template_id) {
    if (template_id.includes('letter') || template_id.includes('seeda')) docType = 'letter';
    else if (template_id.includes('whatsapp') || template_id.includes('absence')) docType = 'whatsapp';
    else if (template_id.includes('dsd')) docType = 'dsd';
    else if (template_id.includes('report')) docType = 'report';
    else docType = 'notice';
  }
  await c.env.DB.prepare('INSERT INTO generated_docs (doc_id, template_id, input_variables, output_text, doc_type, language, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(docId, template_id || null, JSON.stringify(variables || {}), output, docType, lang, uid(c)).run();
  return c.json({ ok: true, data: { doc_id: docId, output, template_id, language: lang } });
});
r.get('/ai/docs', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM generated_docs ORDER BY created_at DESC LIMIT 50').all();
  return c.json({ ok: true, data: rows.results });
});
r.get('/ai/suggest-reply', async (c) => {
  const threadId = c.req.query('thread_id');
  if (!threadId) return c.json({ ok: false, error: 'thread_id required' }, 400);
  const thread = await c.env.DB.prepare('SELECT * FROM inbox_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1').bind(threadId).first<any>();
  if (!thread) return c.json({ ok: false, error: 'Thread not found' }, 404);
  const replyPrompt = `A parent sent this email to Lehakwe Daycare:\n\nSubject: ${thread.subject}\nBody: ${thread.body_text}\n\nSuggest 3 brief, professional reply options. Number them 1, 2, 3. Each under 100 words. Tone: warm, helpful, South African. Include relevant details from the daycare (NPO 22910695, hours 06:30-17:30, address 12625 Phase 6 Bloemside 9323).`;
  const aiResponse = await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
    messages: [
      { role: 'system', content: 'You are a helpful ECD assistant. Suggest professional, warm email replies for a daycare in South Africa.' },
      { role: 'user', content: replyPrompt },
    ],
    max_tokens: 512,
  });
  const suggestions = (aiResponse as any).response || JSON.stringify(aiResponse);
  return c.json({ ok: true, data: { suggestions, thread_id: threadId } });
});

export default r;
