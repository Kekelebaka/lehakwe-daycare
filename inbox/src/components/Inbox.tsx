import { useState, useEffect, useCallback } from 'react';
import { api, ThreadSummary } from '../lib/api';

interface Props {
  onOpenThread: (threadId: string) => void;
  currentStaffId: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: '#DBEAFE', text: '#1D4ED8' },
  in_progress: { bg: '#FEF3C7', text: '#D97706' },
  replied: { bg: '#D1FAE5', text: '#059669' },
  closed: { bg: '#F1F5F9', text: '#64748B' },
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  replied: 'Replied',
  closed: 'Closed',
};

export default function Inbox({ onOpenThread, currentStaffId }: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setThreads(await api.getThreads());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#78716C' }}>Loading messages...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 60, color: '#DC2626' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Inbox</h2>
        <button
          onClick={load}
          style={{
            background: 'white', border: '1px solid #E7E5E4', borderRadius: 8,
            padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {threads.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 12, padding: 48, textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No messages yet</p>
          <p style={{ color: '#78716C', fontSize: '0.9rem' }}>
            Enquiries sent to info@lehakwedaycare.co.za will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {threads.map((t) => {
            const s = STATUS_COLORS[t.status] || STATUS_COLORS.new;
            return (
              <div
                key={t.thread_id}
                onClick={() => onOpenThread(t.thread_id)}
                style={{
                  background: 'white', padding: '16px 20px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 16,
                  borderBottom: '1px solid #F5F5F4',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FFFBEB')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.from_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#44403C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.subject}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{
                    background: s.bg, color: s.text,
                    padding: '3px 10px', borderRadius: 100,
                    fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#A8A29E', minWidth: 50, textAlign: 'right' }}>
                    {formatDate(t.last_message_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
