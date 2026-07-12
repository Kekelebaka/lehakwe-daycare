import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../lib/api';
import { PageHeader, Button, Badge } from '../components/ui';

// Admin view of the notification outbox: trigger fee reminders, flush the queue,
// and see recent delivery status. New-message and new-photo notifications are
// enqueued automatically by those actions — this page is for oversight + fees.
export default function Notifications() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');

  const load = () => api.getNotifications().then(setRows).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const feeReminders = async () => {
    setBusy('fees'); setFlash('');
    try {
      const r = await api.sendFeeReminders();
      setFlash(r.enqueued > 0 ? `Queued ${r.enqueued} fee reminder${r.enqueued === 1 ? '' : 's'} — sending now.` : 'No families with an outstanding balance to remind (or already reminded this month).');
      load();
    } catch (e: any) { setFlash(e.message || 'Could not send reminders.'); } finally { setBusy(''); }
  };

  const flush = async () => {
    setBusy('flush'); setFlash('');
    try {
      const s = await api.dispatchNotifications();
      setFlash(`Outbox flushed — sent ${s.sent}, skipped ${s.skipped}, failed ${s.failed}.`);
      load();
    } catch (e: any) { setFlash(e.message || 'Could not flush the outbox.'); } finally { setBusy(''); }
  };

  const tone = (s: string) => (s === 'sent' ? 'success' : s === 'failed' ? 'danger' : s === 'skipped' ? 'warning' : 'neutral');
  const typeIcon = (t: string) => (t === 'photo' ? '📷' : t === 'fee_reminder' ? '💰' : '💬');

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Parents are notified in their inbox for new messages, new photos, and fee reminders."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={flush} disabled={!!busy}>{busy === 'flush' ? 'Flushing…' : 'Flush outbox'}</Button>
            <Button variant="primary" onClick={feeReminders} disabled={!!busy}>{busy === 'fees' ? 'Queuing…' : '💰 Send fee reminders'}</Button>
          </div>
        }
      />

      {flash && <div style={flashS}>{flash}</div>}

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F1F4', fontWeight: 700, color: '#14213A', fontSize: '0.9rem' }}>Recent notifications</div>
        {loading ? (
          <div style={muted}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={muted}>No notifications yet. New messages, photos and fee reminders will appear here as they're sent.</div>
        ) : (
          <div>
            {rows.map((n) => (
              <div key={n.notification_id} style={rowS}>
                <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{typeIcon(n.type)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#14213A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                    {n.parent_name || 'Unlinked'}{n.child_name ? ` · ${n.child_name}` : ''} · {fmtTime(n.created_at)}
                    {n.last_error ? ` · ${n.last_error}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{n.channel}</span>
                  <Badge tone={tone(n.status)}>{n.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(s: string): string {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const flashS: CSSProperties = { background: '#F5F1FB', border: '1px solid #E4D9F3', color: '#4B1F78', borderRadius: 10, padding: '10px 14px', margin: '12px 0', fontSize: '0.85rem' };
const muted: CSSProperties = { color: '#9CA3AF', fontSize: '0.85rem', padding: 16 };
const rowS: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #F6F6F8' };
