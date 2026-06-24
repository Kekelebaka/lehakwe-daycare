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
  StaffRow, PayslipRow, PayslipItemRow, ChildRow, ParentRow, ComplianceRow, ApiResponse
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
        const childrenCount = 15; // Placeholder until CRUD is fully wired
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

      return Response.json({ ok: false, error: 'Endpoint not found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('API error:', err);
      return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: corsHeaders });
    }
  },
};
