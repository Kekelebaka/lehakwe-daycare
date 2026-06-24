// src/api-routes.ts
import { DB, R2_BUCKET } from './db';
import type { ApiResponse, Env } from './types';

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Authenticated-User-Email',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- STAFF ---
    if (path === '/api/staff' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM staff WHERE active = 1 ORDER BY full_name ASC').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }
    if (path === '/api/staff' && method === 'POST') {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO staff (staff_id, full_name, id_number, employee_number, job_title, email, phone, start_date, basic_salary, uif_enabled, paye_enabled, active, signature, emergency_contact_name, emergency_contact_phone, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.full_name, body.id_number, body.employee_number, body.job_title, body.email, body.phone, body.start_date, body.basic_salary || 0, body.uif_enabled ? 1 : 0, body.paye_enabled ? 1 : 0, body.active ? 1 : 0, body.signature, body.emergency_contact_name, body.emergency_contact_phone, body.notes).run();
      
      await logAudit(env, body.user_id, 'created', 'staff', id, { name: body.full_name });
      return Response.json({ ok: true, data: { staff_id: id } }, { headers: corsHeaders });
    }

    // --- PAYSLIPS ---
    if (path === '/api/payslips' && method === 'GET') {
      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      let query = `
        SELECT p.*, s.full_name, s.job_title, s.email 
        FROM payslips p 
        JOIN staff s ON p.staff_id = s.staff_id 
        ORDER BY p.created_at DESC
      `;
      const binds: any[] = [];
      if (month && year) {
        query += ' WHERE p.pay_period_month = ? AND p.pay_period_year = ?';
        binds.push(parseInt(month), parseInt(year));
      }
      const results = await env.DB.prepare(query).bind(...binds).all();
      
      // Fetch items for each payslip
      const payslips = results.results as any[];
      for (const p of payslips) {
        const items = await env.DB.prepare('SELECT * FROM payslip_items WHERE payslip_id = ?').bind(p.payslip_id).all();
        p.items = items.results;
      }
      return Response.json({ ok: true, data: payslips }, { headers: corsHeaders });
    }

    if (path === '/api/payslips' && method === 'POST') {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO payslips (payslip_id, staff_id, pay_period_month, pay_period_year, payment_date, gross_pay, total_deductions, net_pay, status, prepared_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.staff_id, body.month, body.year, body.payment_date, body.gross_pay, body.total_deductions, body.net_pay, 'generated', body.prepared_by, body.notes).run();

      for (const item of (body.items || [])) {
        await env.DB.prepare(`
          INSERT INTO payslip_items (item_id, payslip_id, item_type, item_name, amount)
          VALUES (?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), id, item.type, item.name, item.amount).run();
      }

      await logAudit(env, body.user_id, 'created', 'payslips', id, { staff_id: body.staff_id, month: body.month, year: body.year });
      return Response.json({ ok: true, data: { payslip_id: id } }, { headers: corsHeaders });
    }

    if (path.match(/^\/api\/payslips\/([^/]+)\/email$/) && method === 'POST') {
      const match = path.match(/^\/api\/payslips\/([^/]+)\/email$/);
      const payslipId = match![1];
      // In a real scenario, this would generate PDF, upload to R2, and email via MailChannels.
      // For MVP, we update status and log.
      await env.DB.prepare('UPDATE payslips SET status = ?, emailed_at = datetime("now") WHERE payslip_id = ?').bind('emailed', payslipId).run();
      await logAudit(env, 'system', 'emailed', 'payslips', payslipId, {});
      return Response.json({ ok: true, data: { status: 'emailed' } }, { headers: corsHeaders });
    }

    if (path.match(/^\/api\/payslips\/([^/]+)\/paid$/) && method === 'POST') {
      const match = path.match(/^\/api\/payslips\/([^/]+)\/paid$/);
      const payslipId = match![1];
      await env.DB.prepare('UPDATE payslips SET status = ?, paid_at = datetime("now") WHERE payslip_id = ?').bind('paid', payslipId).run();
      await logAudit(env, 'system', 'paid', 'payslips', payslipId, {});
      return Response.json({ ok: true, data: { status: 'paid' } }, { headers: corsHeaders });
    }

    // --- CHILDREN ---
    if (path === '/api/children' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM children WHERE status = "active" ORDER BY full_name ASC').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }
    if (path === '/api/children' && method === 'POST') {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO children (child_id, full_name, date_of_birth, age_group, enrolment_date, status, parent_id, emergency_contact_name, emergency_contact_phone, medical_notes, allergies, pickup_authorisation_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.full_name, body.date_of_birth, body.age_group, body.enrolment_date, body.status || 'active', body.parent_id, body.emergency_contact_name, body.emergency_contact_phone, body.medical_notes, body.allergies, body.pickup_authorisation_notes).run();
      return Response.json({ ok: true, data: { child_id: id } }, { headers: corsHeaders });
    }

    // --- PARENTS ---
    if (path === '/api/parents' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM parents ORDER BY full_name ASC').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }
    if (path === '/api/parents' && method === 'POST') {
      const body = await request.json() as any;
      const id = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO parents (parent_id, full_name, phone, email, address, relationship_to_child, emergency_contact, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, body.full_name, body.phone, body.email, body.address, body.relationship_to_child, body.emergency_contact ? 1 : 0, body.notes).run();
      return Response.json({ ok: true, data: { parent_id: id } }, { headers: corsHeaders });
    }

    // --- DOCUMENTS ---
    if (path === '/api/documents' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }

    // --- COMPLIANCE ---
    if (path === '/api/compliance' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM compliance_items ORDER BY category, item_name ASC').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }
    if (path === '/api/compliance' && method === 'PUT') {
      const body = await request.json() as any;
      await env.DB.prepare('UPDATE compliance_items SET status = ?, notes = ?, updated_at = datetime("now") WHERE compliance_id = ?')
        .bind(body.status, body.notes, body.compliance_id).run();
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // --- AUDIT LOGS ---
    if (path === '/api/audit' && method === 'GET') {
      const results = await env.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
      return Response.json({ ok: true, data: results.results }, { headers: corsHeaders });
    }

    // --- INBOX REPLY ---
    if (path.match(/^\/api\/threads\/([^/]+)\/reply$/) && method === 'POST') {
      const match = path.match(/^\/api\/threads\/([^/]+)\/reply$/);
      const threadId = match![1];
      const body = await request.json() as any;
      
      const replyId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO email_replies (reply_id, thread_id, staff_id, body, sent_to, signature_used, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(replyId, threadId, body.staff_id, body.body, body.sent_to, body.signature_used).run();

      await env.DB.prepare('UPDATE inbox_messages SET status = ?, last_replied_at = datetime("now") WHERE thread_id = ?').bind('replied', threadId).run();
      await logAudit(env, body.staff_id, 'replied', 'inbox', threadId, { sent_to: body.sent_to });

      // Mock email send success for MVP (real implementation uses MailChannels fetch)
      return Response.json({ ok: true, data: { reply_id: replyId, sent: true } }, { headers: corsHeaders });
    }

    // --- DASHBOARD STATS ---
    if (path === '/api/dashboard' && method === 'GET') {
      const staffCount = await env.DB.prepare('SELECT COUNT(*) as count FROM staff WHERE active = 1').first();
      const childrenCount = await env.DB.prepare('SELECT COUNT(*) as count FROM children WHERE status = "active"').first();
      const newInbox = await env.DB.prepare('SELECT COUNT(*) as count FROM inbox_messages WHERE status = "new"').first();
      return Response.json({ 
        ok: true, 
        data: { 
          staffCount: (staffCount as any)?.count || 0,
          childrenCount: (childrenCount as any)?.count || 0,
          newInbox: (newInbox as any)?.count || 0
        } 
      }, { headers: corsHeaders });
    }

    return Response.json({ ok: false, error: 'Not found' }, { status: 404, headers: corsHeaders });

  } catch (err) {
    console.error('API Error:', err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: corsHeaders });
  }
}

async function logAudit(env: any, userId: string | undefined, action: string, module: string, recordId: string | undefined, metadata: any) {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (audit_id, user_id, action, module_name, record_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), userId || 'system', action, module, recordId || null, JSON.stringify(metadata)).run();
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
