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
import { signJwt, verifyJwt, hashPassword, verifyPassword, type JwtPayload } from './auth';
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
  JWT_SECRET: string;
  AI: any;
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

    // ── Health check (public) ──
    if (path === '/api/health') {
      return Response.json({ ok: true, ts: Date.now() }, { headers: corsHeaders });
    }

    // ── POST /api/auth/login (public) ──
    if (path === '/api/auth/login' && request.method === 'POST') {
      const { email, password } = await request.json() as { email: string; password: string };
      if (!email || !password) {
        return Response.json({ ok: false, error: 'Email and password required' }, { status: 400, headers: corsHeaders });
      }
      const staff = await db.DB.prepare(
        'SELECT * FROM staff WHERE email = ? AND active = 1 LIMIT 1'
      ).bind(email).first<any>();
      if (!staff || !staff.password_hash) {
        return Response.json({ ok: false, error: 'Invalid credentials' }, { status: 401, headers: corsHeaders });
      }
      const valid = await verifyPassword(password, staff.password_hash);
      if (!valid) {
        return Response.json({ ok: false, error: 'Invalid credentials' }, { status: 401, headers: corsHeaders });
      }
      const role = (staff.job_title === 'Centre Manager' || staff.job_title === 'Daycare Principal') ? 'admin' : 'staff';
      const payload: JwtPayload = {
        sub: staff.staff_id,
        role,
        email: staff.email,
        name: staff.full_name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h
      };
      const token = await signJwt(payload, env.JWT_SECRET);
      return Response.json({ ok: true, data: { token, user: { id: staff.staff_id, name: staff.full_name, email: staff.email, role, signature: staff.signature || '' } } }, { headers: corsHeaders });
    }

    // ── Auth guard: all /api/* except /api/public/*, /api/health, /api/auth/* ──
    let identity: JwtPayload | null = null;
    const isPublic = path.startsWith('/api/public/') || path === '/api/health' || path.startsWith('/api/auth/');
    if (path.startsWith('/api/') && !isPublic) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token) {
        identity = await verifyJwt(token, env.JWT_SECRET);
      }
      if (!identity) {
        return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      }
    }

    try {
      // ── GET /api/me ──
      if (path === '/api/me' && request.method === 'GET') {
        if (!identity) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        const staffRow = await db.DB.prepare(
          'SELECT * FROM staff WHERE staff_id = ? AND active = 1 LIMIT 1'
        ).bind(identity.sub).first<any>();
        if (!staffRow) {
          return Response.json({ ok: false, error: 'Staff record not found' }, { status: 404, headers: corsHeaders });
        }
        return Response.json({ ok: true, data: {
          id: staffRow.staff_id,
          name: staffRow.full_name,
          email: staffRow.email,
          role: identity.role,
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
        const stmt = `INSERT INTO staff (staff_id, full_name, id_number, employee_number, job_title, email, phone, start_date, basic_salary, uif_enabled, paye_enabled, active, signature, emergency_contact_name, emergency_contact_phone, notes, gender, race, disability, disability_description, training_received, training_type, subsidised, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
        await db.DB.prepare(stmt).bind(id, data.full_name, data.id_number || null, data.employee_number || null, data.job_title, data.email || null, data.phone || null, data.start_date || null, data.basic_salary || 0, data.uif_enabled ?? 1, data.paye_enabled ?? 0, data.active ?? 1, data.signature || '', data.emergency_contact_name || null, data.emergency_contact_phone || null, data.notes || null, data.gender || null, data.race || null, data.disability || null, data.disability_description || null, data.training_received || null, data.training_type || null, data.subsidised ?? 1).run();
        
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

      // ── POST /api/payslips/:id/email ──
      const pEmailMatch = path.match(/^\/api\/payslips\/(.+)\/email$/);
      if (pEmailMatch && request.method === 'POST') {
        await db.DB.prepare("UPDATE payslips SET status = 'emailed' WHERE payslip_id = ?").bind(pEmailMatch[1]).run();
        await db.insertAudit({ id: db.uuid(), user_id: identity?.sub || 'admin', action: 'emailed', module_name: 'payslips', record_id: pEmailMatch[1], metadata: '{}' });
        return Response.json({ ok: true, data: { status: 'emailed' } }, { headers: corsHeaders });
      }

      // ── POST /api/payslips/:id/paid ──
      const pPaidMatch = path.match(/^\/api\/payslips\/(.+)\/paid$/);
      if (pPaidMatch && request.method === 'POST') {
        await db.DB.prepare("UPDATE payslips SET status = 'paid' WHERE payslip_id = ?").bind(pPaidMatch[1]).run();
        await db.insertAudit({ id: db.uuid(), user_id: identity?.sub || 'admin', action: 'marked_paid', module_name: 'payslips', record_id: pPaidMatch[1], metadata: '{}' });
        return Response.json({ ok: true, data: { status: 'paid' } }, { headers: corsHeaders });
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
        await db.DB.prepare(`INSERT INTO children (child_id, full_name, date_of_birth, age_group, enrolment_date, status, parent_id, emergency_contact_name, emergency_contact_phone, medical_notes, allergies, pickup_authorisation_notes, gender, race, disability, disability_description, income_category, id_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
          .bind(id, data.full_name, data.date_of_birth || null, data.age_group || null, data.enrolment_date || null, data.status || 'active', data.parent_id || null, data.emergency_contact_name || null, data.emergency_contact_phone || null, data.medical_notes || null, data.allergies || null, data.pickup_authorisation_notes || null, data.gender || null, data.race || null, data.disability || null, data.disability_description || null, data.income_category || null, data.id_number || null).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'children', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true, data: { child_id: id } }, { headers: corsHeaders });
      }

      const childUpdateMatch = path.match(/^\/api\/children\/(.+)$/);
      if (childUpdateMatch && request.method === 'PUT') {
        const id = childUpdateMatch[1];
        const data = await request.json() as Partial<ChildRow>;
        await db.DB.prepare(`UPDATE children SET full_name = COALESCE(?, full_name), date_of_birth = COALESCE(?, date_of_birth), age_group = COALESCE(?, age_group), enrolment_date = COALESCE(?, enrolment_date), status = COALESCE(?, status), parent_id = COALESCE(?, parent_id), emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_phone = COALESCE(?, emergency_contact_phone), medical_notes = COALESCE(?, medical_notes), allergies = COALESCE(?, allergies), pickup_authorisation_notes = COALESCE(?, pickup_authorisation_notes), gender = COALESCE(?, gender), race = COALESCE(?, race), disability = COALESCE(?, disability), disability_description = COALESCE(?, disability_description), income_category = COALESCE(?, income_category), id_number = COALESCE(?, id_number), updated_at = datetime('now') WHERE child_id = ?`)
          .bind(data.full_name ?? null, data.date_of_birth ?? null, data.age_group ?? null, data.enrolment_date ?? null, data.status ?? null, data.parent_id ?? null, data.emergency_contact_name ?? null, data.emergency_contact_phone ?? null, data.medical_notes ?? null, data.allergies ?? null, data.pickup_authorisation_notes ?? null, data.gender ?? null, data.race ?? null, data.disability ?? null, data.disability_description ?? null, data.income_category ?? null, data.id_number ?? null, id).run();
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

      // ── STAFF PUT (edit) ──
      const staffPutMatch = path.match(/^\/api\/staff\/([^/]+)$/);
      if (staffPutMatch && request.method === 'PUT') {
        const id = staffPutMatch[1];
        const data = await request.json() as Partial<StaffRow>;
        await db.DB.prepare(`UPDATE staff SET
          full_name = COALESCE(?, full_name),
          id_number = COALESCE(?, id_number),
          employee_number = COALESCE(?, employee_number),
          job_title = COALESCE(?, job_title),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          start_date = COALESCE(?, start_date),
          basic_salary = COALESCE(?, basic_salary),
          uif_enabled = COALESCE(?, uif_enabled),
          paye_enabled = COALESCE(?, paye_enabled),
          emergency_contact_name = COALESCE(?, emergency_contact_name),
          emergency_contact_phone = COALESCE(?, emergency_contact_phone),
          notes = COALESCE(?, notes),
          gender = COALESCE(?, gender),
          race = COALESCE(?, race),
          disability = COALESCE(?, disability),
          disability_description = COALESCE(?, disability_description),
          training_received = COALESCE(?, training_received),
          training_type = COALESCE(?, training_type),
          subsidised = COALESCE(?, subsidised),
          updated_at = datetime('now')
        WHERE staff_id = ?`).bind(
          data.full_name ?? null, data.id_number ?? null, data.employee_number ?? null,
          data.job_title ?? null, data.email ?? null, data.phone ?? null,
          data.start_date ?? null, data.basic_salary ?? null,
          data.uif_enabled ?? null, data.paye_enabled ?? null,
          data.emergency_contact_name ?? null, data.emergency_contact_phone ?? null,
          data.notes ?? null,
          data.gender ?? null, data.race ?? null, data.disability ?? null,
          data.disability_description ?? null, data.training_received ?? null,
          data.training_type ?? null, data.subsidised ?? null,
          id
        ).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'updated', module_name: 'staff', record_id: id, metadata: JSON.stringify(data) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── STAFF DELETE (soft) ──
      const staffDeleteMatch = path.match(/^\/api\/staff\/([^/]+)$/);
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

      // ── GET /api/attendance?date=YYYY-MM-DD ──
      if (path === '/api/attendance' && request.method === 'GET') {
        const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
        const result = await env.DB.prepare(`
          SELECT a.*, c.full_name AS child_name
          FROM attendance_records a
          JOIN children c ON a.child_id = c.child_id
          WHERE a.date = ?
          ORDER BY c.full_name ASC
        `).bind(date).all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/attendance ──
      if (path === '/api/attendance' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO attendance_records (id, child_id, date, check_in_time, check_out_time, status, absence_reason, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.child_id, body.date, body.check_in_time || null, body.check_out_time || null,
          body.status || 'present', body.absence_reason || null, body.recorded_by || null).run();
        return Response.json({ ok: true, data: { id } }, { headers: corsHeaders });
      }

      // ── PUT /api/attendance/:id ──
      const attMatch = path.match(/^\/api\/attendance\/(.+)$/);
      if (attMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.check_in_time !== undefined) { fields.push('check_in_time = ?'); vals.push(body.check_in_time); }
        if (body.check_out_time !== undefined) { fields.push('check_out_time = ?'); vals.push(body.check_out_time); }
        if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
        if (body.absence_reason !== undefined) { fields.push('absence_reason = ?'); vals.push(body.absence_reason); }
        if (fields.length === 0) return Response.json({ ok: false, error: 'No fields to update' }, { status: 400, headers: corsHeaders });
        vals.push(attMatch[1]);
        await env.DB.prepare(`UPDATE attendance_records SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── GET /api/attendance/summary?month=N&year=N ──
      if (path === '/api/attendance/summary' && request.method === 'GET') {
        const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endMonth = month === 12 ? 1 : month + 1;
        const endYear = month === 12 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
        const result = await env.DB.prepare(`
          SELECT c.child_id, c.full_name,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS days_present,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS days_absent,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) AS days_late,
            COUNT(*) AS total_records
          FROM children c
          LEFT JOIN attendance_records a ON c.child_id = a.child_id AND a.date >= ? AND a.date < ?
          WHERE c.status = 'active'
          GROUP BY c.child_id
          ORDER BY c.full_name ASC
        `).bind(startDate, endDate).all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── GET /api/fees/schedules ──
      if (path === '/api/fees/schedules' && request.method === 'GET') {
        const result = await env.DB.prepare('SELECT * FROM fee_schedules WHERE active = 1 ORDER BY monthly_fee ASC').all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/fees/schedules ──
      if (path === '/api/fees/schedules' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO fee_schedules (schedule_id, age_group, monthly_fee, description) VALUES (?, ?, ?, ?)')
          .bind(id, body.age_group, body.monthly_fee, body.description || null).run();
        return Response.json({ ok: true, data: { id } }, { headers: corsHeaders });
      }

      // ── GET /api/fees/records?month=N&year=N ──
      if (path === '/api/fees/records' && request.method === 'GET') {
        const month = url.searchParams.get('month');
        const year = url.searchParams.get('year');
        let sql = `SELECT f.*, c.full_name AS child_name FROM fee_records f JOIN children c ON f.child_id = c.child_id`;
        const params: any[] = [];
        if (month && year) { sql += ` WHERE f.month = ? AND f.year = ?`; params.push(parseInt(month), parseInt(year)); }
        sql += ` ORDER BY f.year DESC, f.month DESC, c.full_name ASC`;
        const result = params.length ? await env.DB.prepare(sql).bind(...params).all() : await env.DB.prepare(sql).all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/fees/records ──
      if (path === '/api/fees/records' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO fee_records (fee_id, child_id, schedule_id, month, year, amount_due, amount_paid, payment_method, payment_date, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.child_id, body.schedule_id || null, body.month, body.year,
          body.amount_due, body.amount_paid || 0, body.payment_method || null,
          body.payment_date || null, body.status || 'pending', body.notes || null).run();
        return Response.json({ ok: true, data: { id } }, { headers: corsHeaders });
      }

      // ── PUT /api/fees/records/:id ──
      const feeMatch = path.match(/^\/api\/fees\/records\/(.+)$/);
      if (feeMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.amount_paid !== undefined) { fields.push('amount_paid = ?'); vals.push(body.amount_paid); }
        if (body.payment_method !== undefined) { fields.push('payment_method = ?'); vals.push(body.payment_method); }
        if (body.payment_date !== undefined) { fields.push('payment_date = ?'); vals.push(body.payment_date); }
        if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
        if (body.notes !== undefined) { fields.push('notes = ?'); vals.push(body.notes); }
        if (fields.length === 0) return Response.json({ ok: false, error: 'No fields' }, { status: 400, headers: corsHeaders });
        vals.push(feeMatch[1]);
        await env.DB.prepare(`UPDATE fee_records SET ${fields.join(', ')} WHERE fee_id = ?`).bind(...vals).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── GET /api/notices ──
      if (path === '/api/notices' && request.method === 'GET') {
        const result = await env.DB.prepare('SELECT * FROM notices ORDER BY pinned DESC, created_at DESC').all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/notices ──
      if (path === '/api/notices' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO notices (notice_id, title, content, category, pinned, published, expires_at, author_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.title, body.content, body.category || 'general',
          body.pinned ? 1 : 0, body.published ? 1 : 0, body.expires_at || null, body.author_id || null).run();
        return Response.json({ ok: true, data: { id } }, { headers: corsHeaders });
      }

      // ── PUT /api/notices/:id ──
      const noticeMatch = path.match(/^\/api\/notices\/(.+)$/);
      if (noticeMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.title !== undefined) { fields.push('title = ?'); vals.push(body.title); }
        if (body.content !== undefined) { fields.push('content = ?'); vals.push(body.content); }
        if (body.category !== undefined) { fields.push('category = ?'); vals.push(body.category); }
        if (body.pinned !== undefined) { fields.push('pinned = ?'); vals.push(body.pinned ? 1 : 0); }
        if (body.published !== undefined) { fields.push('published = ?'); vals.push(body.published ? 1 : 0); }
        if (body.expires_at !== undefined) { fields.push('expires_at = ?'); vals.push(body.expires_at); }
        fields.push("updated_at = datetime('now')");
        if (fields.length === 1) return Response.json({ ok: false, error: 'No fields' }, { status: 400, headers: corsHeaders });
        vals.push(noticeMatch[1]);
        await env.DB.prepare(`UPDATE notices SET ${fields.join(', ')} WHERE notice_id = ?`).bind(...vals).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── DELETE /api/notices/:id ──
      if (noticeMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM notices WHERE notice_id = ?').bind(noticeMatch[1]).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── GET /api/milestones?child_id=X ──
      if (path === '/api/milestones' && request.method === 'GET') {
        const childId = url.searchParams.get('child_id');
        let sql = 'SELECT m.*, c.full_name AS child_name FROM developmental_milestones m JOIN children c ON m.child_id = c.child_id';
        const params: any[] = [];
        if (childId) { sql += ' WHERE m.child_id = ?'; params.push(childId); }
        sql += ' ORDER BY c.full_name, m.milestone_type';
        const result = params.length ? await env.DB.prepare(sql).bind(...params).all() : await env.DB.prepare(sql).all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/milestones ──
      if (path === '/api/milestones' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO developmental_milestones (milestone_id, child_id, milestone_type, status, achieved_date, notes, assessed_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.child_id, body.milestone_type, body.status || 'pending',
          body.achieved_date || null, body.notes || null, body.assessed_by || null).run();
        return Response.json({ ok: true, data: { id } }, { headers: corsHeaders });
      }

      // ── PUT /api/milestones/:id ──
      const mileMatch = path.match(/^\/api\/milestones\/(.+)$/);
      if (mileMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
        if (body.achieved_date !== undefined) { fields.push('achieved_date = ?'); vals.push(body.achieved_date); }
        if (body.notes !== undefined) { fields.push('notes = ?'); vals.push(body.notes); }
        if (body.assessed_by !== undefined) { fields.push('assessed_by = ?'); vals.push(body.assessed_by); }
        if (fields.length === 0) return Response.json({ ok: false, error: 'No fields' }, { status: 400, headers: corsHeaders });
        vals.push(mileMatch[1]);
        await env.DB.prepare(`UPDATE developmental_milestones SET ${fields.join(', ')} WHERE milestone_id = ?`).bind(...vals).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── GET /api/waitlist ──
      if (path === '/api/waitlist' && request.method === 'GET') {
        const result = await env.DB.prepare('SELECT * FROM waitlist ORDER BY position ASC, created_at ASC').all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/waitlist ──
      if (path === '/api/waitlist' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        const maxPos = await env.DB.prepare('SELECT MAX(position) AS max_pos FROM waitlist').first<{ max_pos: number }>();
        const position = (maxPos?.max_pos || 0) + 1;
        await env.DB.prepare(`
          INSERT INTO waitlist (waitlist_id, child_name, parent_name, parent_phone, parent_email, age_group, preferred_start_date, status, notes, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.child_name, body.parent_name || null, body.parent_phone || null,
          body.parent_email || null, body.age_group || null, body.preferred_start_date || null,
          body.status || 'waiting', body.notes || null, position).run();
        return Response.json({ ok: true, data: { id, position } }, { headers: corsHeaders });
      }

      // ── PUT /api/waitlist/:id ──
      const waitMatch = path.match(/^\/api\/waitlist\/(.+)$/);
      if (waitMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
        if (body.position !== undefined) { fields.push('position = ?'); vals.push(body.position); }
        if (body.notes !== undefined) { fields.push('notes = ?'); vals.push(body.notes); }
        fields.push("updated_at = datetime('now')");
        if (fields.length === 1) return Response.json({ ok: false, error: 'No fields' }, { status: 400, headers: corsHeaders });
        vals.push(waitMatch[1]);
        await env.DB.prepare(`UPDATE waitlist SET ${fields.join(', ')} WHERE waitlist_id = ?`).bind(...vals).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── DELETE /api/waitlist/:id ──
      if (waitMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM waitlist WHERE waitlist_id = ?').bind(waitMatch[1]).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── GET /api/ai/templates ──
      if (path === '/api/ai/templates' && request.method === 'GET') {
        const templates = await env.DB.prepare('SELECT * FROM ai_templates WHERE active = 1 ORDER BY category, name').all();
        return Response.json({ ok: true, data: templates.results }, { headers: corsHeaders });
      }

      // ── POST /api/ai/generate ──
      if (path === '/api/ai/generate' && request.method === 'POST') {
        const body = await request.json() as any;
        const { template_id, variables, custom_prompt, language } = body;

        let prompt = '';
        if (template_id) {
          const tpl = await env.DB.prepare('SELECT * FROM ai_templates WHERE template_id = ?').bind(template_id).first();
          if (!tpl) return Response.json({ ok: false, error: 'Template not found' }, { status: 404, headers: corsHeaders });
          prompt = tpl.prompt_template as string;
          // Replace variables
          if (variables) {
            for (const [key, value] of Object.entries(variables)) {
              prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value as string);
            }
          }
        } else if (custom_prompt) {
          prompt = custom_prompt;
        } else {
          return Response.json({ ok: false, error: 'Provide template_id or custom_prompt' }, { status: 400, headers: corsHeaders });
        }

        // Add language instruction if not English
        const lang = language || 'en';
        const langMap: Record<string, string> = { en: 'English', st: 'Sesotho', af: 'Afrikaans', zu: 'Zulu' };
        if (lang !== 'en') {
          prompt = `Please write this in ${langMap[lang] || lang}. Keep the same meaning and tone.\n\n${prompt}`;
        }

        // Call Cloudflare Workers AI
        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [
            { role: 'system', content: 'You are a professional South African ECD (Early Childhood Development) assistant for Lehakwe Daycare (NPO 22910695). Write in a warm, professional tone. Use South African English conventions. Always include relevant NPO and contact details when writing letters.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1024,
        });

        const output = (aiResponse as any).response || JSON.stringify(aiResponse);

        // Save to generated_docs
        const docId = `doc-${Date.now()}`;
        let docType = 'custom';
        if (template_id) {
          if (template_id.includes('letter') || template_id.includes('seeda')) docType = 'letter';
          else if (template_id.includes('whatsapp') || template_id.includes('absence')) docType = 'whatsapp';
          else if (template_id.includes('dsd')) docType = 'dsd';
          else if (template_id.includes('report')) docType = 'report';
          else docType = 'notice';
        }
        await env.DB.prepare(
          'INSERT INTO generated_docs (doc_id, template_id, input_variables, output_text, doc_type, language, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(docId, template_id || null, JSON.stringify(variables || {}), output, docType, lang, 'admin').run();

        return Response.json({ ok: true, data: { doc_id: docId, output, template_id, language: lang } }, { headers: corsHeaders });
      }

      // ── GET /api/ai/docs ──
      if (path === '/api/ai/docs' && request.method === 'GET') {
        const docs = await env.DB.prepare('SELECT * FROM generated_docs ORDER BY created_at DESC LIMIT 50').all();
        return Response.json({ ok: true, data: docs.results }, { headers: corsHeaders });
      }

      // ── GET /api/ai/suggest-reply ──
      if (path === '/api/ai/suggest-reply' && request.method === 'GET') {
        const threadId = url.searchParams.get('thread_id');
        if (!threadId) return Response.json({ ok: false, error: 'thread_id required' }, { status: 400, headers: corsHeaders });

        const thread = await env.DB.prepare('SELECT * FROM inbox_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 1').bind(threadId).first<any>();
        if (!thread) return Response.json({ ok: false, error: 'Thread not found' }, { status: 404, headers: corsHeaders });

        const replyPrompt = `A parent sent this email to Lehakwe Daycare:\n\nSubject: ${thread.subject}\nBody: ${thread.body_text}\n\nSuggest 3 brief, professional reply options. Number them 1, 2, 3. Each under 100 words. Tone: warm, helpful, South African. Include relevant details from the daycare (NPO 22910695, hours 06:30-17:30, address 12625 Phase 6 Bloemside 9323).`;

        const aiResponse = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [
            { role: 'system', content: 'You are a helpful ECD assistant. Suggest professional, warm email replies for a daycare in South Africa.' },
            { role: 'user', content: replyPrompt }
          ],
          max_tokens: 512,
        });

        const suggestions = (aiResponse as any).response || JSON.stringify(aiResponse);
        return Response.json({ ok: true, data: { suggestions, thread_id: threadId } }, { headers: corsHeaders });
      }

      // ── GET /api/town/config ──
      if (path === '/api/town/config' && request.method === 'GET') {
        const config = await env.DB.prepare('SELECT * FROM town_config WHERE active = 1').all();
        return Response.json({ ok: true, data: config.results }, { headers: corsHeaders });
      }

      // ── GET /api/town/stats ──
      if (path === '/api/town/stats' && request.method === 'GET') {
        const [children, staff, centres] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM children WHERE status = \'active\'').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM staff WHERE active = 1').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM town_config WHERE active = 1').first(),
        ]);
        return Response.json({ ok: true, data: {
          total_children: children?.count || 0,
          total_staff: staff?.count || 0,
          total_centres: centres?.count || 0,
          town: 'Bloemfontein',
          coordinator: 'Keke Lebaka',
        }}, { headers: corsHeaders });
      }

      // ═══════════════════════════════════════════════════════
      // PUBLIC PARENT PORTAL (no auth required)
      // ═══════════════════════════════════════════════════════

      // ── GET /api/public/child/:token ──
      if (path.startsWith('/api/public/child/') && request.method === 'GET') {
        const portalToken = path.split('/').pop();
        const child = await env.DB.prepare(
          `SELECT c.child_id, c.full_name, c.date_of_birth, c.age_group, c.status,
                  p.full_name as parent_name, p.phone as parent_phone, p.email as parent_email
           FROM children c LEFT JOIN parents p ON c.parent_id = p.parent_id
           WHERE c.portal_token = ?`
        ).bind(portalToken).first();
        if (!child) return Response.json({ ok: false, error: 'Child not found' }, { status: 404, headers: corsHeaders });

        // Get attendance this month
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const attendance = await env.DB.prepare(
          `SELECT * FROM attendance_records WHERE child_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
           ORDER BY date DESC`
        ).bind((child as any).child_id, String(month).padStart(2, '0'), String(year)).all();

        // Get fee records
        const fees = await env.DB.prepare(
          `SELECT * FROM fee_records WHERE child_id = ? ORDER BY year DESC, month DESC LIMIT 12`
        ).bind((child as any).child_id).all();

        // Get published notices
        const notices = await env.DB.prepare(
          `SELECT * FROM notices WHERE published = 1 ORDER BY pinned DESC, created_at DESC LIMIT 10`
        ).all();

        // Get settings (centre info)
        const settings = await env.DB.prepare('SELECT * FROM settings LIMIT 1').first();

        // Calculate outstanding balance
        const totalDue = fees.results.reduce((sum: number, f: any) => sum + (f.amount_due || 0), 0);
        const totalPaid = fees.results.reduce((sum: number, f: any) => sum + (f.amount_paid || 0), 0);

        return Response.json({ ok: true, data: {
          child,
          attendance: attendance.results,
          fees: fees.results,
          notices: notices.results,
          settings,
          balance: { total_due: totalDue, total_paid: totalPaid, outstanding: totalDue - totalPaid },
        }}, { headers: corsHeaders });
      }

      // ── GET /api/public/qr/:token ── (returns a simple QR URL)
      if (path.startsWith('/api/public/qr/') && request.method === 'GET') {
        const portalToken = path.split('/').pop();
        return Response.json({ ok: true, data: { url: `https://app.lehakwedaycare.co.za/parent/${portalToken}` } }, { headers: corsHeaders });
      }

      // ═══════════════════════════════════════════════════════
      // DAILY LOGS
      // ═══════════════════════════════════════════════════════

      // ── GET /api/daily-logs?date=YYYY-MM-DD&child_id=xxx ──
      if (path === '/api/daily-logs' && request.method === 'GET') {
        const date = url.searchParams.get('date');
        const childId = url.searchParams.get('child_id');
        let query = `SELECT dl.*, c.full_name as child_name, s.full_name as staff_name
                     FROM daily_logs dl
                     LEFT JOIN children c ON dl.child_id = c.child_id
                     LEFT JOIN staff s ON dl.staff_id = s.staff_id WHERE 1=1`;
        const params: any[] = [];
        if (date) { query += ' AND dl.log_date = ?'; params.push(date); }
        if (childId) { query += ' AND dl.child_id = ?'; params.push(childId); }
        query += ' ORDER BY dl.created_at DESC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const logs = await stmt.all();
        return Response.json({ ok: true, data: logs.results }, { headers: corsHeaders });
      }

      // ── POST /api/daily-logs ──
      if (path === '/api/daily-logs' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = `log-${Date.now()}`;
        await env.DB.prepare(
          `INSERT INTO daily_logs (log_id, child_id, staff_id, log_date, activity_type, description, mood, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, body.child_id, body.staff_id || 'system', body.log_date, body.activity_type, body.description, body.mood || null, body.notes || null).run();
        return Response.json({ ok: true, data: { log_id: id } }, { headers: corsHeaders });
      }

      // ── DELETE /api/daily-logs/:id ──
      if (path.startsWith('/api/daily-logs/') && request.method === 'DELETE') {
        const logId = path.split('/').pop();
        await env.DB.prepare('DELETE FROM daily_logs WHERE log_id = ?').bind(logId).run();
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ═══════════════════════════════════════════════════════
      // LEAVE REQUESTS
      // ═══════════════════════════════════════════════════════

      // ── GET /api/leave?status=xxx&staff_id=xxx ──
      if (path === '/api/leave' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const staffId = url.searchParams.get('staff_id');
        let query = `SELECT lr.*, s.full_name AS staff_name
                     FROM leave_requests lr
                     LEFT JOIN staff s ON lr.staff_id = s.staff_id WHERE 1=1`;
        const params: any[] = [];
        if (status) { query += ' AND lr.status = ?'; params.push(status); }
        if (staffId) { query += ' AND lr.staff_id = ?'; params.push(staffId); }
        query += ' ORDER BY lr.created_at DESC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const result = await stmt.all();
        return Response.json({ ok: true, data: result.results }, { headers: corsHeaders });
      }

      // ── POST /api/leave ──
      if (path === '/api/leave' && request.method === 'POST') {
        const body = await request.json() as any;
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO leave_requests (leave_id, staff_id, leave_type, start_date, end_date, reason, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).bind(id, body.staff_id, body.leave_type, body.start_date, body.end_date, body.reason || null).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'created', module_name: 'leave_requests', record_id: id, metadata: JSON.stringify(body) });
        return Response.json({ ok: true, data: { leave_id: id } }, { headers: corsHeaders });
      }

      // ── PUT /api/leave/:id ──
      const leaveMatch = path.match(/^\/api\/leave\/(.+)$/);
      if (leaveMatch && request.method === 'PUT') {
        const body = await request.json() as any;
        const fields: string[] = [];
        const vals: any[] = [];
        if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
        if (body.approved_by !== undefined) { fields.push('approved_by = ?'); vals.push(body.approved_by); }
        if (body.reason !== undefined) { fields.push('reason = ?'); vals.push(body.reason); }
        if (fields.length === 0) return Response.json({ ok: false, error: 'No fields to update' }, { status: 400, headers: corsHeaders });
        vals.push(leaveMatch[1]);
        await env.DB.prepare(`UPDATE leave_requests SET ${fields.join(', ')} WHERE leave_id = ?`).bind(...vals).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'updated', module_name: 'leave_requests', record_id: leaveMatch[1], metadata: JSON.stringify(body) });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── DELETE /api/leave/:id ──
      if (leaveMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM leave_requests WHERE leave_id = ?').bind(leaveMatch[1]).run();
        await db.insertAudit({ id: db.uuid(), user_id: 'admin', action: 'deleted', module_name: 'leave_requests', record_id: leaveMatch[1], metadata: '{}' });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      return Response.json({ ok: false, error: 'Endpoint not found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('API error:', err);
      return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: corsHeaders });
    }
  },
};
