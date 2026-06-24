import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Inbox() {
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [replyBody, setReplyBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>({ name: 'Admin', id: 'admin-1' });

  useEffect(() => {
    api.getMe().then(setUser).catch(() => {});
    loadThreads();
  }, []);

  const loadThreads = () => {
    api.getThreads().then(setThreads).catch(() => {});
  };

  const selectThread = async (id: string) => {
    setLoading(true);
    try {
      const thread = await api.getThread(id);
      setSelectedThread(thread);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedThread || !replyBody.trim()) return;
    setLoading(true);
    try {
      await api.sendReply(selectedThread.thread_id, user.id, replyBody);
      setReplyBody('');
      const updated = await api.getThread(selectedThread.thread_id);
      setSelectedThread(updated);
      loadThreads(); // Refresh list to update status
    } catch (e) {
      alert('Failed to send reply. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', gap: 16 }}>
      {/* Thread List */}
      <div className="card" style={{ width: 320, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Inbox</h3>
          <button className="btn btn-secondary" onClick={loadThreads} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>↻</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threads.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: '0.85rem' }}>No messages yet.</p>
            </div>
          ) : (
            threads.map(t => (
              <div
                key={t.thread_id}
                onClick={() => selectThread(t.thread_id)}
                style={{
                  padding: 16, borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                  background: selectedThread?.thread_id === t.thread_id ? '#FEF3C7' : 'white',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.from_name || t.from_email}</span>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{formatDate(t.last_message_at)}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                  {t.subject}
                </div>
                <span style={{
                  fontSize: '0.7rem', padding: '2px 6px', borderRadius: 100,
                  background: t.status === 'new' ? '#DBEAFE' : t.status === 'replied' ? '#D1FAE5' : '#F3F4F6',
                  color: t.status === 'new' ? '#1D4ED8' : t.status === 'replied' ? '#059669' : '#6B7280',
                  textTransform: 'capitalize', fontWeight: 600
                }}>
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread Detail */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {selectedThread ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{selectedThread.messages[0]?.subject}</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>
                From: {selectedThread.messages[0]?.from_name} &lt;{selectedThread.messages[0]?.from_email}&gt;
              </p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedThread.messages.map((msg: any) => (
                <div key={msg.message_id} style={{
                  background: msg.direction === 'inbound' ? '#F3F4F6' : '#D1FAE5',
                  padding: 16, borderRadius: 12, maxWidth: '85%',
                  alignSelf: msg.direction === 'inbound' ? 'flex-start' : 'flex-end',
                  borderLeft: msg.direction === 'inbound' ? '4px solid #3B82F6' : '4px solid #10B981'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{msg.direction === 'inbound' ? msg.from_name : 'Lehakwe Daycare'}</span>
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.body_text}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #E5E7EB', background: 'white' }}>
              <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 8 }}>
                Replying as: <strong>Lehakwe Daycare &lt;info@lehakwedaycare.co.za&gt;</strong>
              </div>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Type your reply here..."
                rows={4}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleReply} disabled={loading || !replyBody.trim()}>
                  {loading ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>✉️</div>
              <p>Select a message to view the conversation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
