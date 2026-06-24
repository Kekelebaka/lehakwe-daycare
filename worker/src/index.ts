import type { ForwardableEmailMessage, D1Database, R2Bucket } from '@cloudflare/workers-types';
import { EmailMessage } from 'cloudflare:email';
import { initDb } from './db';
import {
  parseIncomingEmail,
  buildForwardBody,
  buildAutoReply,
  applySignature,
  buildReplyRaw,
} from './email-handler';
import type { SendRequest } from './types';
import type {
  StaffRow, PayslipRow, PayslipItemRow, ChildRow, ParentRow, ComplianceRow, DocumentRow, SettingRow, ApiResponse
} from './manager-types';

interface Env {
  DB: D1Database;
  EMAIL_STORE: R2Bucket;
  FORWARD_EMAILS: string;
  AUTO_REPLY_ENABLED: string;
  SENDING_DOMAIN: string;
  ALLOWED_ORIGIN: string;
}

export default {
  // ── Email Workers handler ──────────────────────────────────
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    const db = initDb(env.DB);
    const parsed = await parseIncomingEmail(message);
    const threadId = db.uuid();
    const now = new Date().toISOString();

    const fromMatch = parsed.from.match(/<(.+?)>$/);
    const fromEmail = fromMatch ? fromMatch[1] : parsed.from;

    // Save to D1
    await db.insertMessage({
      id: db.uuid(),
      thread_id: threadId,
      direction: 'inbound',
      from_email: fromEmail,
      from_name: parsed.from_name,
      to_email: parsed.to,
      subject: parsed.subject,
      body_text: parsed.text,
      body_html: '',
      raw_email_ref: '',
      status: 'new',
      assigned_to: null,
    });

    // Forward to staff
    const forwardEmails = env.FORWARD_EMAILS.split(',').map(e => e.trim()).filter(Boolean);
    const forwardBody = buildForwardBody(
      parsed.from_name, fromEmail, parsed.subject, parsed.text, now, threadId
    );

    for (const staffEmail of forwardEmails) {
      try {
        const fwdHeaders = new Headers();
        fwdHeaders.set('subject', `[New Enquiry] ${parsed.subject}`);
        await message.forward(staffEmail, fwdHeaders);
      } catch (e) {
        console.error(`Failed to forward to ${staffEmail}:`, e);
      }
    }

    // Auto-reply to sender
    if (env.AUTO_REPLY_ENABLED === 'true') {
      try {
        const replyRaw = buildReplyRaw(
          `info@${env.SENDING_DOMAIN}`, 'Lehakwe Daycare', fromEmail,
          `Re: ${parsed.subject}`, buildAutoReply(parsed.from_name)
        );
        const replyMsg = new EmailMessage(`info@${env.SENDING_DOMAIN}`, fromEmail, replyRaw);
        await message.reply(replyMsg);
      } catch (e) {
        console.error('Failed to send auto-reply:', e);
      }
    }

    // Audit log
    await db.insertAudit({
      id: db.uuid(),
      thread_id: threadId,
      staff_id: 'system',
      action: 'received',
      metadata: JSON.stringify({ from: parsed.from, subject: parsed.subject, forwarded_to: forwardEmails }),
    });
  },

  // ── HTTP API handler (for Manager app) ─────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = initDb(env.DB);
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': (() => {
        const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((o: string) => o.trim());
        const origin = request.headers.get('Origin') || '';
        return allowed.includes(origin) ? origin : allowed[0] || '*';
      })(),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── GET /api/me ──
      if (path === '/api/me' && request.method === 'GET') {
        const email = request.headers.get('Cf-Access-Authenticated-User-Email');
        if (!email) {
          // Dev fallback — only works when Cloudflare Access is not enforcing
          return Response.json({ ok: true, data: { id: 'dev-admin', name: 'Dev Admin', email: 'admin@lehakwedaycare.co.za', role: 'admin', signature: '', active: 1 } }, { headers: corsHeaders });
        }
        const staffRow = await db.DB.prepare(
          'SELECT * FROM staff WHERE email = ? AND active = 1 LIMIT 1'
        ).bind(email).first<any>();
        if (!staffRow) {
          return Response.json({ ok: false, error: 'Access denied — staff record not found for ' + email }, { status: 403, headers: corsHeaders });
        }
        return Response.json({ ok: true, data: {
          id: staffRow.staff_id,
          name: staffRow.full_name,
          email: staffRow.email,
          role: (staffRow.job_title === 'Centre Manager' || staffRow.job_title === 'Daycare Principal') ? 'admin' : 'staff',
          signature: staffRow.signature || '',
          active: staffRow.active,
        }}, { headers: corsHeaders });
      }

      // ── GET /api/dashboard ──
      if (path === '/api/dashboard' && request.method === 'GET') {
        const staffCount = await db.getAllStaff().then(s => s.length);
        const childrenRow = await db.DB.prepare('SELECT COUNT(*) as count FROM children').first<{count: number}>();
        const childrenCount = childrenRow?.count ?? 0;
        const newInbox = await db.getAllThreads().then(t => t.filter(x => x.status === 'new').length);
        return Response.json({
          ok: true, data: { staffCount, childrenCount, newInbox, payrollStatus: 'pending' }
        }, { headers: corsHeaders });
      }

      // ── STAFF CRUD ──
      if (path === '/api/staff' && request.method === 'GET') {
        const staff = await db.getAllStaff();
        return Response.json({ ok: true, data: staff }, { headers: corsHeaders });
      }
      if (path === '/api/staff' && request.method === 'POST') {
        const data = await request.json() as Partial<StaffRow>;
        const id = db.uuid();
        const stmt = `INSERT INTO staff (staff_id, full_name, job_title, basic_salary, active, signature, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`;
        await db.DB.prepare(stmt).bind(id, data.full_name, data.job_title, data.basic_salary || 0, data.signature || '').run();
        
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'staff', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { staff_id: id } }, { headers: corsHeaders });
      }

      // ── PAYSLIPS CRUD ──
      if (path === '/api/payslips' && request.method === 'GET') {
        const month = url.searchParams.get('month');
        const year = url.searchParams.get('year');
        let query = 'SELECT * FROM payslips';
        const params: any[] = [];
        if (month && year) {
          query += ' WHERE pay_period_month = ? AND pay_period_year = ?';
          params.push(parseInt(month), parseInt(year));
        }
        const result = await db.DB.prepare(query).bind(...params).all<PayslipRow>();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }
      if (path === '/api/payslips' && request.method === 'POST') {
        const data = await request.json() as Partial<PayslipRow>;
        const id = db.uuid();
        await db.DB.prepare(`
          INSERT INTO payslips (payslip_id, staff_id, pay_period_month, pay_period_year, gross_pay, total_deductions, net_pay, status, prepared_by, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'generated', 'Admin', datetime('now'))
        `).bind(id, data.staff_id, data.pay_period_month, data.pay_period_year, data.gross_pay, data.total_deductions, data.net_pay).run();
        
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'generated', module_name: 'payslips', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { payslip_id: id } }, { headers: corsHeaders });
      }

      // ── CHILDREN CRUD ──
      if (path === '/api/children' && request.method === 'GET') {
        const result = await db.DB.prepare('SELECT * FROM children ORDER BY full_name ASC').all<ChildRow>();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── PARENTS CRUD ──
      if (path === '/api/parents' && request.method === 'GET') {
        const result = await db.DB.prepare('SELECT * FROM parents ORDER BY full_name ASC').all<ParentRow>();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── CHILDREN CRUD ──
      if (path === '/api/children' && request.method === 'POST') {
        const data = await request.json() as Partial<ChildRow>;
        const id = db.uuid();
        await db.DB.prepare(`INSERT INTO children (child_id, full_name, date_of_birth, age_group, enrolment_date, status, parent_id, emergency_contact_name, emergency_contact_phone, medical_notes, allergies, pickup_authorisation_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
          .bind(id, data.full_name, data.date_of_birth || null, data.age_group || null, data.enrolment_date || null, data.status || 'active', data.parent_id || null, data.emergency_contact_name || null, data.emergency_contact_phone || null, data.medical_notes || null, data.allergies || null, data.pickup_authorisation_notes || null).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'children', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { child_id: id } }, { headers: corsHeaders });
      }

      const childUpdateMatch = path.match(/^\/api\/children\/(.+)$/);
      if (childUpdateMatch && request.method === 'PUT') {
        const id = childUpdateMatch[1];
        const data = await request.json() as Partial<ChildRow>;
        await db.DB.prepare(`UPDATE children SET full_name = COALESCE(?, full_name), date_of_birth = COALESCE(?, date_of_birth), age_group = COALESCE(?, age_group), enrolment_date = COALESCE(?, enrolment_date), status = COALESCE(?, status), parent_id = COALESCE(?, parent_id), emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_phone = COALESCE(?, emergency_contact_phone), medical_notes = COALESCE(?, medical_notes), allergies = COALESCE(?, allergies), pickup_authorisation_notes = COALESCE(?, pickup_authorisation_notes), updated_at = datetime('now') WHERE child_id = ?`)
          .bind(data.full_name ?? null, data.date_of_birth ?? null, data.age_group ?? null, data.enrolment_date ?? null, data.status ?? null, data.parent_id ?? null, data.emergency_contact_name ?? null, data.emergency_contact_phone ?? null, data.medical_notes ?? null, data.allergies ?? null, data.pickup_authorisation_notes ?? null, id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'updated', module_name: 'children', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      if (childUpdateMatch && request.method === 'DELETE') {
        const id = childUpdateMatch[1];
        await db.DB.prepare('DELETE FROM children WHERE child_id = ?').bind(id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'deleted', module_name: 'children', record_id: id, metadata: '{}' });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── PARENTS CRUD ──
      if (path === '/api/parents' && request.method === 'POST') {
        const data = await request.json() as Partial<ParentRow>;
        const id = db.uuid();
        await db.DB.prepare(`INSERT INTO parents (parent_id, full_name, phone, email, address, relationship_to_child, emergency_contact, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
          .bind(id, data.full_name, data.phone || null, data.email || null, data.address || null, data.relationship_to_child || null, data.emergency_contact || 0, data.notes || null).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'parents', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { parent_id: id } }, { headers: corsHeaders });
      }

      const parentUpdateMatch = path.match(/^\/api\/parents\/(.+)$/);
      if (parentUpdateMatch && request.method === 'PUT') {
        const id = parentUpdateMatch[1];
        const data = await request.json() as Partial<ParentRow>;
        await db.DB.prepare(`UPDATE parents SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address), relationship_to_child = COALESCE(?, relationship_to_child), emergency_contact = COALESCE(?, emergency_contact), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE parent_id = ?`)
          .bind(data.full_name ?? null, data.phone ?? null, data.email ?? null, data.address ?? null, data.relationship_to_child ?? null, data.emergency_contact ?? null, data.notes ?? null, id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'updated', module_name: 'parents', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      if (parentUpdateMatch && request.method === 'DELETE') {
        const id = parentUpdateMatch[1];
        await db.DB.prepare('DELETE FROM parents WHERE parent_id = ?').bind(id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'deleted', module_name: 'parents', record_id: id, metadata: '{}' });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── DOCUMENTS CRUD ──
      if (path === '/api/documents' && request.method === 'GET') {
        const entityType = url.searchParams.get('related_entity_type');
        const entityId = url.searchParams.get('related_entity_id');
        let query = 'SELECT * FROM documents';
        const params: any[] = [];
        if (entityType && entityId) {
          query += ' WHERE related_entity_type = ? AND related_entity_id = ?';
          params.push(entityType, entityId);
        } else if (entityType) {
          query += ' WHERE related_entity_type = ?';
          params.push(entityType);
        }
        query += ' ORDER BY uploaded_at DESC';
        const result = await db.DB.prepare(query).bind(...params).all<DocumentRow>();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      if (path === '/api/documents' && request.method === 'POST') {
        const data = await request.json() as Partial<DocumentRow>;
        const id = db.uuid();
        await db.DB.prepare(`INSERT INTO documents (document_id, related_entity_type, related_entity_id, document_type, title, expiry_date, file_url, status, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .bind(id, data.related_entity_type, data.related_entity_id, data.document_type, data.title, data.expiry_date || null, data.file_url || null, data.status || 'active', data.uploaded_by || null).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'documents', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { document_id: id } }, { headers: corsHeaders });
      }

      const docDeleteMatch = path.match(/^\/api\/documents\/(.+)$/);
      if (docDeleteMatch && request.method === 'DELETE') {
        const id = docDeleteMatch[1];
        await db.DB.prepare('DELETE FROM documents WHERE document_id = ?').bind(id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'deleted', module_name: 'documents', record_id: id, metadata: '{}' });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── SETTINGS CRUD ──
      if (path === '/api/settings' && request.method === 'GET') {
        const result = await db.DB.prepare('SELECT * FROM settings').all<SettingRow>();
        const settingsObj: Record<string, string> = {};
        for (const row of result.results) {
          settingsObj[row.setting_key] = row.setting_value;
        }
        return Response.json({ ok: true, data: settingsObj }, { headers: corsHeaders });
      }

      if (path === '/api/settings' && request.method === 'PUT') {
        const { settings } = await request.json() as { settings: Record<string, string> };
        const stmt = db.DB.prepare(`INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')`);
        const batch = Object.entries(settings).map(([key, value]) => stmt.bind(key, value));
        await db.DB.batch(batch);
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'updated', module_name: 'settings', record_id: 'bulk', metadata: JSON.stringify({ keys: Object.keys(settings) }) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── STAFF DELETE (soft) ──
      const staffDeleteMatch = path.match(/^\/api\/staff\/(.+)$/);
      if (staffDeleteMatch && request.method === 'DELETE') {
        const id = staffDeleteMatch[1];
        await db.DB.prepare('UPDATE staff SET active = 0, updated_at = datetime(\'now\') WHERE staff_id = ?').bind(id).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'deactivated', module_name: 'staff', record_id: id, metadata: '{}' });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── COMPLIANCE ──
      if (path === '/api/compliance' && request.method === 'GET') {
        const result = await db.DB.prepare('SELECT * FROM compliance_items ORDER BY category ASC').all<ComplianceRow>();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }
      if (path.startsWith('/api/compliance/') && request.method === 'PUT') {
        const id = path.split('/').pop();
        const { status, notes } = await request.json() as { status: string; notes?: string };
        await db.DB.prepare('UPDATE compliance_items SET status = ?, notes = ?, updated_at = datetime(\'now\') WHERE compliance_id = ?')
          .bind(status, notes || null, id).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── INBOX (Existing) ──
      if (path === '/api/threads' && request.method === 'GET') {
        const threads = await db.getAllThreads();
        return Response.json({ ok: true, data: threads }, { headers: corsHeaders });
      }
      if (path.match(/^\/api\/threads\/(.+)$/) && request.method === 'GET') {
        const threadId = path.match(/^\/api\/threads\/(.+)$/)![1];
        const [messages, notes, auditLogs] = await Promise.all([db.getThread(threadId), db.getNotes(threadId), db.getAuditLogs(threadId)]);
        return Response.json({ ok: true, data: { thread_id: threadId, messages, notes, audit_logs: auditLogs } }, { headers: corsHeaders });
      }

      // ── AUDIT ──
      if (path === '/api/audit' && request.method === 'GET') {
        const result = await db.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── PUT /api/threads/:id/status ──
      const statusMatch = path.match(/^\/api\/threads\/(.+)\/status$/);
      if (statusMatch && request.method === 'PUT') {
        const threadId = statusMatch[1];
        const { status, staff_id } = await request.json() as any;
        await db.updateStatus(threadId, status);
        await db.insertAudit({ id: db.uuid(), thread_id: threadId, staff_id: staff_id || 'system', action: status === 'closed' ? 'closed' : 'assigned', metadata: JSON.stringify({ status }) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── PUT /api/threads/:id/assign ──
      const assignMatch = path.match(/^\/api\/threads\/(.+)\/assign$/);
      if (assignMatch && request.method === 'PUT') {
        const threadId = assignMatch[1];
        const { staff_id } = await request.json() as any;
        await db.assignThread(threadId, staff_id);
        await db.insertAudit({ id: db.uuid(), thread_id: threadId, staff_id: staff_id || 'system', action: 'assigned', metadata: JSON.stringify({ staff_id }) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── POST /api/notes ──
      if (path === '/api/notes' && request.method === 'POST') {
        const { thread_id, staff_id, note } = await request.json() as any;
        const noteId = db.uuid();
        await db.insertNote({ id: noteId, thread_id, staff_id, note });
        await db.insertAudit({ id: db.uuid(), thread_id, staff_id: staff_id || 'system', action: 'noted', metadata: '{}' });
        return Response.json({ ok: true, data: { id: noteId } }, { headers: corsHeaders });
      }

      // ── GET /api/templates ──
      if (path === '/api/templates' && request.method === 'GET') {
        const templates = await db.getTemplates();
        return Response.json({ ok: true, data: templates }, { headers: corsHeaders });
      }

      // ── POST /api/send  (inbox app style reply) ──
      // ── POST /api/threads/:id/reply  (manager app style reply) ──
      const replyPathMatch = path.match(/^\/api\/threads\/(.+)\/reply$/);
      if ((path === '/api/send' || replyPathMatch) && request.method === 'POST') {
        const body_raw = await request.json() as any;
        const thread_id = body_raw.thread_id || (replyPathMatch ? replyPathMatch[1] : null);
        const staff_id  = body_raw.staff_id || 'system';
        const replyBody = body_raw.body || '';
        const template_id = body_raw.template_id;

        if (!thread_id) return Response.json({ ok: false, error: 'thread_id required' }, { status: 400, headers: corsHeaders });

        // Fetch original message for recipient info
        const msgs = await db.getThread(thread_id);
        const original = msgs[0];
        if (!original) return Response.json({ ok: false, error: 'Thread not found' }, { status: 404, headers: corsHeaders });

        // Resolve final body (template or manual)
        let finalBody = replyBody;
        if (template_id) {
          const tpl = await db.getTemplate(template_id);
          if (tpl) finalBody = tpl.body.replace('[SIGNATURE]', '');
        }

        // Update thread status
        await db.updateStatus(thread_id, 'replied');

        // Audit
        await db.insertAudit({ id: db.uuid(), thread_id, staff_id, action: 'replied', metadata: JSON.stringify({ body_length: finalBody.length }) });

        // Note: email sending from HTTP Workers requires MailChannels or similar.
        // Status is updated — the reply is recorded. Email delivery to be configured separately.
        return Response.json({ ok: true, data: { message_id: db.uuid(), sent: false, note: 'Status updated. Configure MailChannels to enable outbound email from HTTP handlers.' } }, { headers: corsHeaders });
      }

      return Response.json({ ok: false, error: 'Endpoint not found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('API error:', err);
      return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: corsHeaders });
    }
  },
};
