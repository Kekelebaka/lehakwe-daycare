// Shared messaging helpers for the parent↔staff conversation feature (PR #8).
// One thread per child. Read receipts: a message is "read" when the OTHER side
// opens the thread (read_at is stamped). Used by both the staff routes
// (routes/messages.ts) and the parent routes (routes/parent.ts).
//
// Phase 4: every call is tenant-scoped by centreId. The child lookup, thread and
// messages are all constrained to the caller's centre so one centre can never open
// or post to another centre's thread — even with a guessed childId/threadId.
import type { D1Database } from '@cloudflare/workers-types';
import { DEFAULT_CENTRE_ID } from './tenant';

export type Side = 'staff' | 'parent';

// Find the child's thread, creating it on first use. Returns null if the child
// does not exist IN THIS CENTRE. parent_id is copied from the child (may be null).
export async function getOrCreateThread(
  db: D1Database,
  childId: string,
  centreId: string = DEFAULT_CENTRE_ID,
): Promise<{ thread_id: string; parent_id: string | null } | null> {
  const child = await db
    .prepare('SELECT child_id, parent_id FROM children WHERE child_id = ? AND centre_id = ?')
    .bind(childId, centreId)
    .first<{ child_id: string; parent_id: string | null }>();
  if (!child) return null;

  const existing = await db
    .prepare('SELECT thread_id FROM message_threads WHERE child_id = ? AND centre_id = ?')
    .bind(childId, centreId)
    .first<{ thread_id: string }>();
  if (existing) return { thread_id: existing.thread_id, parent_id: child.parent_id ?? null };

  const thread_id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO message_threads (thread_id, child_id, parent_id, centre_id) VALUES (?, ?, ?, ?)')
    .bind(thread_id, childId, child.parent_id ?? null, centreId)
    .run();
  return { thread_id, parent_id: child.parent_id ?? null };
}

// Mark every message from the OTHER side as read (read receipt for the reader).
export async function markThreadRead(
  db: D1Database,
  threadId: string,
  reader: Side,
  centreId: string = DEFAULT_CENTRE_ID,
): Promise<void> {
  const other: Side = reader === 'staff' ? 'parent' : 'staff';
  await db
    .prepare("UPDATE thread_messages SET read_at = datetime('now') WHERE thread_id = ? AND sender_type = ? AND read_at IS NULL AND centre_id = ?")
    .bind(threadId, other, centreId)
    .run();
}

// Append a message and bump the thread's last_message_at. Returns the new id + timestamp.
export async function insertThreadMessage(
  db: D1Database,
  threadId: string,
  senderType: Side,
  senderId: string,
  senderName: string,
  body: string,
  centreId: string = DEFAULT_CENTRE_ID,
): Promise<{ message_id: string; created_at: string }> {
  const message_id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO thread_messages (message_id, thread_id, sender_type, sender_id, sender_name, body, centre_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(message_id, threadId, senderType, senderId, senderName, body, centreId)
    .run();
  await db
    .prepare("UPDATE message_threads SET last_message_at = datetime('now') WHERE thread_id = ? AND centre_id = ?")
    .bind(threadId, centreId)
    .run();
  const row = await db
    .prepare('SELECT created_at FROM thread_messages WHERE message_id = ? AND centre_id = ?')
    .bind(message_id, centreId)
    .first<{ created_at: string }>();
  return { message_id, created_at: row?.created_at ?? new Date().toISOString() };
}
