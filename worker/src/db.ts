import type { D1Database } from '@cloudflare/workers-types';
import type { MessageRow, StaffRow, NoteRow, AuditLogRow, TemplateRow } from './types';

function uuid(): string {
  return crypto.randomUUID();
}

export function initDb(db: D1Database) {
  return {
    // --- Messages ---
    async insertMessage(msg: Omit<MessageRow, 'created_at'>): Promise<void> {
      await db.prepare(`
        INSERT INTO messages (id, thread_id, direction, from_email, from_name, to_email, subject, body_text, body_html, raw_email_ref, status, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(msg.id, msg.thread_id, msg.direction, msg.from_email, msg.from_name, msg.to_email,
              msg.subject, msg.body_text, msg.body_html ?? '', msg.raw_email_ref ?? '',
              msg.status, msg.assigned_to ?? null).run();
    },

    async getThread(threadId: string): Promise<MessageRow[]> {
      const result = await db.prepare(
        'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC'
      ).bind(threadId).all<MessageRow>();
      return result.results;
    },

    async getAllThreads(): Promise<{ thread_id: string; subject: string; from_name: string; from_email: string; status: string; last_message_at: string; message_count: number }[]> {
      const result = await db.prepare(`
        SELECT thread_id, subject, from_name, from_email, status,
               MAX(created_at) as last_message_at,
               COUNT(*) as message_count
        FROM messages
        WHERE direction = 'inbound'
        GROUP BY thread_id
        ORDER BY last_message_at DESC
      `).all();
      return result.results as unknown as any[];
    },

    async updateStatus(threadId: string, status: string): Promise<void> {
      await db.prepare(
        'UPDATE messages SET status = ? WHERE thread_id = ?'
      ).bind(status, threadId).run();
    },

    async assignThread(threadId: string, staffId: string): Promise<void> {
      await db.prepare(
        'UPDATE messages SET assigned_to = ?, status = ? WHERE thread_id = ?'
      ).bind(staffId, 'in_progress', threadId).run();
    },

    // --- Staff ---
    async getStaff(staffId: string): Promise<StaffRow | null> {
      return await db.prepare(
        'SELECT * FROM staff WHERE id = ? AND active = 1'
      ).bind(staffId).first<StaffRow>();
    },

    async getStaffByEmail(email: string): Promise<StaffRow | null> {
      return await db.prepare(
        'SELECT * FROM staff WHERE email = ? AND active = 1'
      ).bind(email).first<StaffRow>();
    },

    async getAllStaff(): Promise<StaffRow[]> {
      const result = await db.prepare(
        'SELECT * FROM staff WHERE active = 1 ORDER BY name ASC'
      ).all<StaffRow>();
      return result.results;
    },

    // --- Notes ---
    async insertNote(note: Omit<NoteRow, 'created_at'>): Promise<void> {
      await db.prepare(
        'INSERT INTO notes (id, thread_id, staff_id, note) VALUES (?, ?, ?, ?)'
      ).bind(note.id, note.thread_id, note.staff_id, note.note).run();
    },

    async getNotes(threadId: string): Promise<NoteRow[]> {
      const result = await db.prepare(
        'SELECT n.*, s.name as staff_name FROM notes n LEFT JOIN staff s ON n.staff_id = s.id WHERE n.thread_id = ? ORDER BY n.created_at ASC'
      ).bind(threadId).all<NoteRow & { staff_name: string }>();
      return result.results as unknown as NoteRow[];
    },

    // --- Audit ---
    async insertAudit(log: Omit<AuditLogRow, 'created_at'>): Promise<void> {
      await db.prepare(
        'INSERT INTO audit_logs (id, thread_id, staff_id, action, metadata) VALUES (?, ?, ?, ?, ?)'
      ).bind(log.id, log.thread_id, log.staff_id, log.action, log.metadata).run();
    },

    async getAuditLogs(threadId: string): Promise<AuditLogRow[]> {
      const result = await db.prepare(
        'SELECT a.*, s.name as staff_name FROM audit_logs a LEFT JOIN staff s ON a.staff_id = s.id WHERE a.thread_id = ? ORDER BY a.created_at DESC'
      ).bind(threadId).all<AuditLogRow & { staff_name: string }>();
      return result.results as unknown as AuditLogRow[];
    },

    // --- Templates ---
    async getTemplates(): Promise<TemplateRow[]> {
      const result = await db.prepare(
        'SELECT * FROM templates ORDER BY sort_order ASC'
      ).all<TemplateRow>();
      return result.results;
    },

    async getTemplate(id: string): Promise<TemplateRow | null> {
      return await db.prepare(
        'SELECT * FROM templates WHERE id = ?'
      ).bind(id).first<TemplateRow>();
    },

    // --- Helpers ---
    uuid,
  };
}
