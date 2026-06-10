import type { ForwardableEmailMessage } from '@cloudflare/workers-types';
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

    // Extract email from "Name <email>" format
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
      parsed.from_name, fromEmail,
      parsed.subject, parsed.text,
      now, threadId
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
          `info@${env.SENDING_DOMAIN}`,
          'Lehakwe Daycare',
          fromEmail,
          `Re: ${parsed.subject}`,
          buildAutoReply(parsed.from_name)
        );
        const replyMsg = new EmailMessage(
          `info@${env.SENDING_DOMAIN}`,
          fromEmail,
          replyRaw
        );
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
      metadata: JSON.stringify({
        from: parsed.from,
        subject: parsed.subject,
        forwarded_to: forwardEmails,
        auto_reply: env.AUTO_REPLY_ENABLED === 'true',
      }),
    });
  },

  // ── HTTP API handler (for inbox app) ───────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = initDb(env.DB);
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── GET /api/threads ──
      if (path === '/api/threads' && request.method === 'GET') {
        const threads = await db.getAllThreads();
        return Response.json({ ok: true, data: threads }, { headers: corsHeaders });
      }

      // ── GET /api/threads/:id ──
      const threadMatch = path.match(/^\/api\/threads\/(.+)$/);
      if (threadMatch && request.method === 'GET') {
        const threadId = threadMatch[1];
        const [messages, notes, auditLogs] = await Promise.all([
          db.getThread(threadId),
          db.getNotes(threadId),
          db.getAuditLogs(threadId),
        ]);
        return Response.json(
          { ok: true, data: { thread_id: threadId, messages, notes, audit_logs: auditLogs } },
          { headers: corsHeaders }
        );
      }

      // ── PUT /api/threads/:id/status ──
      const statusMatch = path.match(/^\/api\/threads\/(.+)\/status$/);
      if (statusMatch && request.method === 'PUT') {
        const threadId = statusMatch[1];
        const { status, staff_id } = await request.json() as { status: string; staff_id: string };
        await db.updateStatus(threadId, status);
        await db.insertAudit({
          id: db.uuid(),
          thread_id: threadId,
          staff_id: staff_id || 'system',
          action: status === 'closed' ? 'closed' : 'assigned',
          metadata: JSON.stringify({ status }),
        });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── PUT /api/threads/:id/assign ──
      const assignMatch = path.match(/^\/api\/threads\/(.+)\/assign$/);
      if (assignMatch && request.method === 'PUT') {
        const threadId = assignMatch[1];
        const { staff_id, assigner_id } = await request.json() as { staff_id: string; assigner_id: string };
        await db.assignThread(threadId, staff_id);
        await db.insertAudit({
          id: db.uuid(),
          thread_id: threadId,
          staff_id: assigner_id || 'system',
          action: 'assigned',
          metadata: JSON.stringify({ assigned_to: staff_id }),
        });
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      // ── POST /api/send ──
      if (path === '/api/send' && request.method === 'POST') {
        const { thread_id, staff_id, body, template_id } = await request.json() as SendRequest;
        const staff = await db.getStaff(staff_id);
        if (!staff) {
          return Response.json({ ok: false, error: 'Staff not found' }, { status: 404, headers: corsHeaders });
        }

        const thread = await db.getThread(thread_id);
        if (!thread.length) {
          return Response.json({ ok: false, error: 'Thread not found' }, { status: 404, headers: corsHeaders });
        }

        const firstMsg = thread[0];
        const replyBody = applySignature(body, staff.name);
        const replySubject = firstMsg.subject.startsWith('Re:') ? firstMsg.subject : `Re: ${firstMsg.subject}`;

        // Send via MailChannels (Cloudflare's email sending partner)
        let sendResult = false;
        try {
          const sendResp = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: firstMsg.from_email, name: firstMsg.from_name }] }],
              from: { email: `info@${env.SENDING_DOMAIN}`, name: 'Lehakwe Daycare' },
              reply_to: { email: `info@${env.SENDING_DOMAIN}`, name: 'Lehakwe Daycare' },
              subject: replySubject,
              content: [{ type: 'text/plain', value: replyBody }],
            }),
          });
          sendResult = sendResp.status === 202 || sendResp.status === 200;
        } catch (e) {
          console.error('Send failed:', e);
        }

        // Save outbound message
        const msgId = db.uuid();
        await db.insertMessage({
          id: msgId,
          thread_id,
          direction: 'outbound',
          from_email: `info@${env.SENDING_DOMAIN}`,
          from_name: `Lehakwe Daycare (${staff.name})`,
          to_email: firstMsg.from_email,
          subject: replySubject,
          body_text: replyBody,
          body_html: '',
          raw_email_ref: '',
          status: 'replied',
          assigned_to: staff_id,
        });

        await db.updateStatus(thread_id, 'replied');

        await db.insertAudit({
          id: db.uuid(),
          thread_id,
          staff_id,
          action: 'replied',
          metadata: JSON.stringify({
            sent: sendResult,
            template_used: template_id || null,
            sent_to: firstMsg.from_email,
          }),
        });

        return Response.json(
          { ok: sendResult, data: { message_id: msgId, sent: sendResult } },
          { headers: corsHeaders }
        );
      }

      // ── POST /api/notes ──
      if (path === '/api/notes' && request.method === 'POST') {
        const { thread_id, staff_id, note } = await request.json() as {
          thread_id: string; staff_id: string; note: string;
        };
        const noteId = db.uuid();
        await db.insertNote({ id: noteId, thread_id, staff_id, note });
        await db.insertAudit({
          id: db.uuid(),
          thread_id,
          staff_id,
          action: 'noted',
          metadata: JSON.stringify({ note_id: noteId }),
        });
        return Response.json({ ok: true, data: { id: noteId } }, { headers: corsHeaders });
      }

      // ── GET /api/templates ──
      if (path === '/api/templates' && request.method === 'GET') {
        const templates = await db.getTemplates();
        return Response.json({ ok: true, data: templates }, { headers: corsHeaders });
      }

      // ── GET /api/staff ──
      if (path === '/api/staff' && request.method === 'GET') {
        const staff = await db.getAllStaff();
        return Response.json({ ok: true, data: staff }, { headers: corsHeaders });
      }

      // ── GET /api/me ──
      if (path === '/api/me' && request.method === 'GET') {
        const email = request.headers.get('Cf-Access-Authenticated-User-Email') || '';
        if (!email) {
          return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: corsHeaders });
        }
        const staff = await db.getStaffByEmail(email);
        if (!staff) {
          return Response.json({ ok: false, error: 'Staff not found' }, { status: 403, headers: corsHeaders });
        }
        return Response.json({ ok: true, data: staff }, { headers: corsHeaders });
      }

      return Response.json({ ok: false, error: 'Not found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('API error:', err);
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
