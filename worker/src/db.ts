import type { D1Database } from '@cloudflare/workers-types';
import type { MessageRow, StaffRow, NoteRow, AuditLogRow, TemplateRow } from './types';
import { DEFAULT_CENTRE_ID } from './tenant';

function uuid(): string { return crypto.randomUUID(); }

// Tenant-aware DB helper. Pass the request's centreId so every write carries it and
// every inbox / staff / audit read is scoped to that centre. Defaults to centre #1
// for the single-tenant email + cron paths on the Lehakwe instance.
export function initDb(db: D1Database, centreId: string = DEFAULT_CENTRE_ID) {
  const centre = centreId;
  return {

    // ── inbox_messages (was: messages) ─────────────────────────────────────
    async insertMessage(msg: Omit<MessageRow, 'created_at'>): Promise<void> {
      await db.prepare(`
        INSERT INTO inbox_messages
          (message_id, thread_id, from_email, from_name, to_email, subject,
           body_text, body_html, status, assigned_to, centre_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        msg.id, msg.thread_id, msg.from_email, msg.from_name, msg.to_email,
        msg.subject, msg.body_text, msg.body_html ?? '',
        msg.status, msg.assigned_to ?? null, centre
      ).run();
    },

    async getThread(threadId: string): Promise<MessageRow[]> {
      const result = await db.prepare(`
        SELECT message_id AS id, thread_id, from_email, from_name, to_email,
               subject, body_text, body_html, status, assigned_to, created_at,
               'inbound' AS direction, '' AS raw_email_ref
        FROM inbox_messages WHERE thread_id = ? AND centre_id = ? ORDER BY created_at ASC
      `).bind(threadId, centre).all<MessageRow>();
      return result.results;
    },

    async getAllThreads(): Promise<{
      thread_id: string; subject: string; from_name: string; from_email: string;
      status: string; last_message_at: string; message_count: number;
    }[]> {
      const result = await db.prepare(`
        SELECT thread_id, subject, from_name, from_email, status,
               MAX(created_at) AS last_message_at, COUNT(*) AS message_count
        FROM inbox_messages
        WHERE centre_id = ?
        GROUP BY thread_id
        ORDER BY last_message_at DESC
      `).bind(centre).all();
      return result.results as unknown as any[];
    },

    async updateStatus(threadId: string, status: string): Promise<void> {
      await db.prepare(
        "UPDATE inbox_messages SET status = ?, updated_at = datetime('now') WHERE thread_id = ? AND centre_id = ?"
      ).bind(status, threadId, centre).run();
    },

    async assignThread(threadId: string, staffId: string): Promise<void> {
      await db.prepare(
        "UPDATE inbox_messages SET assigned_to = ?, status = 'in_progress', updated_at = datetime('now') WHERE thread_id = ? AND centre_id = ?"
      ).bind(staffId, threadId, centre).run();
    },

    // ── staff ──────────────────────────────────────────────────────────────
    async getStaff(staffId: string): Promise<StaffRow | null> {
      return db.prepare('SELECT * FROM staff WHERE staff_id = ? AND active = 1 AND centre_id = ?')
        .bind(staffId, centre).first<StaffRow>();
    },

    async getStaffByEmail(email: string): Promise<StaffRow | null> {
      return db.prepare('SELECT * FROM staff WHERE email = ? AND active = 1 AND centre_id = ?')
        .bind(email, centre).first<StaffRow>();
    },

    async getAllStaff(): Promise<StaffRow[]> {
      const result = await db.prepare(
        'SELECT * FROM staff WHERE active = 1 AND centre_id = ? ORDER BY full_name ASC'
      ).bind(centre).all<StaffRow>();
      return result.results;
    },

    // ── inbox_notes (was: notes) ───────────────────────────────────────────
    async insertNote(note: Omit<NoteRow, 'created_at'>): Promise<void> {
      await db.prepare(
        'INSERT INTO inbox_notes (note_id, thread_id, staff_id, note, centre_id) VALUES (?, ?, ?, ?, ?)'
      ).bind(note.id, note.thread_id, note.staff_id, note.note, centre).run();
    },

    async getNotes(threadId: string): Promise<NoteRow[]> {
      const result = await db.prepare(`
        SELECT n.note_id AS id, n.thread_id, n.staff_id, n.note, n.created_at,
               s.full_name AS staff_name
        FROM inbox_notes n
        LEFT JOIN staff s ON n.staff_id = s.staff_id
        WHERE n.thread_id = ? AND n.centre_id = ? ORDER BY n.created_at ASC
      `).bind(threadId, centre).all<NoteRow & { staff_name: string }>();
      return result.results as unknown as NoteRow[];
    },

    // ── audit_logs (live schema: audit_id, user_id, module_name, record_id, timestamp) ──
    async insertAudit(log: any): Promise<void> {
      // Handles both old inbox style (thread_id, staff_id) and new manager style (user_id, module_name, record_id)
      await db.prepare(
        'INSERT INTO audit_logs (audit_id, user_id, action, module_name, record_id, metadata, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        log.id || uuid(),
        log.user_id || log.staff_id || 'system',
        log.action,
        log.module_name || 'inbox',
        log.record_id || log.thread_id || '',
        log.metadata || '{}',
        centre
      ).run();
    },

    async getAuditLogs(threadId: string): Promise<AuditLogRow[]> {
      const result = await db.prepare(`
        SELECT audit_id AS id, record_id AS thread_id, user_id AS staff_id,
               action, metadata, timestamp AS created_at
        FROM audit_logs
        WHERE module_name = 'inbox' AND record_id = ? AND centre_id = ?
        ORDER BY timestamp DESC
      `).bind(threadId, centre).all<AuditLogRow>();
      return result.results;
    },

    // ── templates (SHARED / global reference — intentionally NOT tenant-scoped) ──
    async getTemplates(): Promise<TemplateRow[]> {
      const result = await db.prepare(
        'SELECT * FROM templates ORDER BY sort_order ASC'
      ).all<TemplateRow>();
      return result.results;
    },

    async getTemplate(id: string): Promise<TemplateRow | null> {
      return db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first<TemplateRow>();
    },

    // ── helpers ────────────────────────────────────────────────────────────
    uuid,
    DB: db,
    centreId: centre,
  };
}
