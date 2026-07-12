// Notification outbox (PR #10). Enqueue parent-facing notifications, then dispatch
// them via the parent's channel. Email works now (Resend); SMS/WhatsApp is an
// adapter that stays inert until SMS_PROVIDER_* is set; push is a future channel.
//
// Reliability: notifications are enqueued to a table and delivered by dispatchPending(),
// which is called inline (best-effort, via waitUntil) after each enqueue AND by a Cron
// trigger as a retry/safety net. An optimistic claim (pending -> sending) prevents the
// two dispatch paths from double-sending the same row.
import type { Env } from './env';
import { sendEmailViaResend } from './lib';

export type NotificationType = 'message' | 'photo' | 'fee_reminder';
export type Channel = 'email' | 'sms' | 'whatsapp' | 'push' | 'none';

const APP_URL = 'https://app.lehakwedaycare.co.za/my';
const MAX_ATTEMPTS = 5;

type ParentContact = { full_name?: string | null; email?: string | null; phone?: string | null } | null;

// Decide how to reach a parent. Email preferred; SMS/WhatsApp when a gateway is
// configured; otherwise 'none' (the queued notification is marked skipped).
export function resolveChannel(parent: ParentContact, env: Env): Channel {
  if (!parent) return 'none';
  if (parent.email && parent.email.includes('@')) return 'email';
  if (parent.phone && env.SMS_PROVIDER_URL && env.SMS_PROVIDER_KEY) return 'sms';
  return 'none';
}

// Enqueue a notification. Idempotent when dedupeKey is provided (INSERT OR IGNORE
// against the unique dedupe index). Returns true only if a row was actually inserted.
// No-op (false) when there is no parent to notify.
export async function enqueue(
  env: Env,
  n: { parentId?: string | null; childId?: string | null; type: NotificationType; title: string; body: string; dedupeKey?: string | null },
): Promise<boolean> {
  if (!n.parentId) return false;
  const id = crypto.randomUUID();
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO notifications (notification_id, parent_id, child_id, type, title, body, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, n.parentId, n.childId ?? null, n.type, n.title, n.body, n.dedupeKey ?? null).run();
  return ((res.meta as any)?.changes ?? 0) === 1;
}

async function deliver(env: Env, row: { title: string; body: string }, parent: ParentContact): Promise<{ ok: boolean; channel: Channel; error?: string }> {
  const channel = resolveChannel(parent, env);
  if (channel === 'none') return { ok: false, channel, error: 'no contact channel on file' };
  const text = `${row.body}\n\nOpen your parent app: ${APP_URL}\n\nUbuntu Daycare OS — Powered by ChiefOps`;

  if (channel === 'email') {
    const ok = await sendEmailViaResend(env, {
      to: parent!.email as string,
      fromName: 'Ubuntu Daycare OS',
      fromEmail: `info@${env.SENDING_DOMAIN}`,
      subject: row.title,
      text,
    });
    return { ok, channel, error: ok ? undefined : 'email send failed (is RESEND_API_KEY set?)' };
  }
  // SMS / WhatsApp gateway — pluggable, inert until SMS_PROVIDER_URL + SMS_PROVIDER_KEY are set.
  if (channel === 'sms') {
    try {
      const res = await fetch(env.SMS_PROVIDER_URL as string, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SMS_PROVIDER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: parent!.phone, message: `${row.title}: ${row.body}` }),
      });
      return { ok: res.ok, channel, error: res.ok ? undefined : `sms gateway responded ${res.status}` };
    } catch {
      return { ok: false, channel, error: 'sms gateway error' };
    }
  }
  return { ok: false, channel, error: 'channel not implemented' };
}

// Process pending notifications. Claims each row (pending -> sending) so concurrent
// dispatchers don't double-send, then delivers and records the outcome.
export async function dispatchPending(env: Env, limit = 25): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  const stats = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const pend = await env.DB.prepare(
    `SELECT notification_id FROM notifications WHERE status = 'pending' AND attempts < ? ORDER BY created_at ASC LIMIT ?`,
  ).bind(MAX_ATTEMPTS, limit).all<{ notification_id: string }>();

  for (const { notification_id } of pend.results) {
    const claim = await env.DB.prepare(
      `UPDATE notifications SET status = 'sending', attempts = attempts + 1 WHERE notification_id = ? AND status = 'pending'`,
    ).bind(notification_id).run();
    if (((claim.meta as any)?.changes ?? 0) !== 1) continue; // another dispatcher won the claim

    const row = await env.DB.prepare(
      `SELECT n.notification_id, n.parent_id, n.title, n.body, n.attempts,
              p.full_name, p.email, p.phone
       FROM notifications n LEFT JOIN parents p ON n.parent_id = p.parent_id
       WHERE n.notification_id = ?`,
    ).bind(notification_id).first<any>();
    if (!row) continue;
    stats.processed++;

    const parent: ParentContact = row.parent_id ? { full_name: row.full_name, email: row.email, phone: row.phone } : null;
    const res = await deliver(env, { title: row.title, body: row.body }, parent);

    if (res.ok) {
      await env.DB.prepare(`UPDATE notifications SET status = 'sent', channel = ?, sent_at = datetime('now'), last_error = NULL WHERE notification_id = ?`).bind(res.channel, notification_id).run();
      stats.sent++;
    } else if (res.channel === 'none') {
      await env.DB.prepare(`UPDATE notifications SET status = 'skipped', last_error = ? WHERE notification_id = ?`).bind(res.error ?? 'no channel', notification_id).run();
      stats.skipped++;
    } else {
      const terminal = (row.attempts ?? 1) >= MAX_ATTEMPTS;
      await env.DB.prepare(`UPDATE notifications SET status = ?, channel = ?, last_error = ? WHERE notification_id = ?`)
        .bind(terminal ? 'failed' : 'pending', res.channel, res.error ?? 'send failed', notification_id).run();
      stats.failed++;
    }
  }
  return stats;
}

// Recover rows stuck in 'sending' (e.g. a crash mid-dispatch) so Cron can retry them.
export async function resetStaleSending(env: Env): Promise<void> {
  await env.DB.prepare(`UPDATE notifications SET status = 'pending' WHERE status = 'sending' AND created_at < datetime('now', '-15 minutes')`).run();
}

// Enqueue a fee reminder for every active child with an outstanding balance and a
// linked parent. Idempotent per child per calendar month. Returns count newly enqueued.
export async function enqueueFeeReminders(env: Env): Promise<number> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const rows = await env.DB.prepare(
    `SELECT c.child_id, c.full_name, c.parent_id,
            COALESCE(SUM(f.amount_due), 0) - COALESCE(SUM(f.amount_paid), 0) AS outstanding
     FROM children c
     JOIN fee_records f ON f.child_id = c.child_id
     WHERE c.status = 'active' AND c.parent_id IS NOT NULL
     GROUP BY c.child_id
     HAVING outstanding > 0`,
  ).all<any>();

  let count = 0;
  for (const r of rows.results) {
    const amount = Math.round(Number(r.outstanding));
    const inserted = await enqueue(env, {
      parentId: r.parent_id,
      childId: r.child_id,
      type: 'fee_reminder',
      title: `Fee reminder for ${r.full_name}`,
      body: `Our records show an outstanding balance of R${amount.toLocaleString()} for ${r.full_name}. Please contact the centre if you have any questions or have already paid.`,
      dedupeKey: `fee:${r.child_id}:${period}`,
    });
    if (inserted) count++;
  }
  return count;
}
