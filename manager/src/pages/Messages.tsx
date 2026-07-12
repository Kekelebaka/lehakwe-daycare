import { useState, useEffect, useRef } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui';

// Staff-side of parent messaging: pick a child on the left, chat with their
// parent on the right. One conversation per child; read receipts shown on
// messages you sent once the parent has opened them.
export default function Messages() {
  const [threads, setThreads] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [thread, setThread] = useState<any>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = () => api.getMessageThreads().then(setThreads).catch(() => {}).finally(() => setLoadingList(false));
  useEffect(() => { loadThreads(); }, []);

  const openChild = (childId: string) => {
    setSelected(childId);
    setThread(null);
    api.getMessageThread(childId).then(setThread).catch(() => {});
  };

  useEffect(() => {
    if (thread && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !selected) return;
    setSending(true);
    try {
      await api.sendMessage(selected, body);
      setText('');
      const t = await api.getMessageThread(selected);
      setThread(t);
      loadThreads();
    } catch { /* ignore */ } finally { setSending(false); }
  };

  return (
    <div>
      <PageHeader title="Messages" subtitle="Chat directly with parents — one private conversation per child." />
      <div style={wrap}>
        {/* Thread list */}
        <div style={listPane}>
          {loadingList ? (
            <div style={muted}>Loading…</div>
          ) : threads.length === 0 ? (
            <div style={muted}>No active children yet.</div>
          ) : (
            threads.map((t) => (
              <button key={t.child_id} onClick={() => openChild(t.child_id)} style={listItem(selected === t.child_id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#14213A' }}>{t.child_name}</span>
                  {t.unread > 0 && <span style={unreadDot}>{t.unread}</span>}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#6B7280' }}>{t.parent_name || 'No parent linked'}</div>
                {t.last_body && (
                  <div style={{ fontSize: '0.74rem', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_body}</div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div style={chatPane}>
          {!thread ? (
            <div style={{ ...muted, margin: 'auto', textAlign: 'center' }}>Select a child to view the conversation.</div>
          ) : (
            <>
              <div style={chatHead}>
                <div style={{ fontWeight: 800, color: '#14213A' }}>{thread.child?.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  {thread.parent
                    ? `${thread.parent.full_name}${thread.parent.email ? ` · ${thread.parent.email}` : ''}`
                    : 'No parent linked — they won’t see messages until a parent is linked to this child'}
                </div>
              </div>
              <div ref={scrollRef} style={chatScroll}>
                {(thread.messages || []).length === 0 ? (
                  <div style={muted}>No messages yet. Send the first one below.</div>
                ) : (
                  thread.messages.map((m: any) => {
                    const mine = m.sender_type === 'staff';
                    return (
                      <div key={m.message_id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                        <div style={bubble(mine)}>{m.body}</div>
                        <div style={metaLine(mine)}>
                          {mine ? (m.sender_name || 'You') : (m.sender_name || 'Parent')} · {fmtTime(m.created_at)}{mine && m.read_at ? ' · Read' : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={send} style={composer}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message to the parent…" style={composerInput} />
                <button type="submit" disabled={sending || !text.trim()} style={sendBtn(sending || !text.trim())}>Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtTime(s: string): string {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const wrap: CSSProperties = { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' };
const listPane: CSSProperties = { flex: '1 1 240px', maxWidth: 340, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '72vh', overflowY: 'auto' };
const chatPane: CSSProperties = { flex: '2 1 360px', minWidth: 280, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', minHeight: 440, maxHeight: '72vh' };
const muted: CSSProperties = { color: '#9CA3AF', fontSize: '0.85rem', padding: 16 };
const listItem = (active: boolean): CSSProperties => ({ textAlign: 'left', border: `1px solid ${active ? '#4B1F78' : '#E5E7EB'}`, background: active ? '#F5F1FB' : 'white', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 });
const unreadDot: CSSProperties = { background: '#F7931E', color: 'white', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', flexShrink: 0 };
const chatHead: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #F1F1F4' };
const chatScroll: CSSProperties = { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 };
const bubble = (mine: boolean): CSSProperties => ({ background: mine ? '#4B1F78' : '#F1EEF8', color: mine ? 'white' : '#14213A', padding: '8px 12px', borderRadius: 12, fontSize: '0.88rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' });
const metaLine = (mine: boolean): CSSProperties => ({ fontSize: '0.62rem', color: '#9CA3AF', marginTop: 2, textAlign: mine ? 'right' : 'left' });
const composer: CSSProperties = { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #F1F1F4' };
const composerInput: CSSProperties = { flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: '0.9rem', boxSizing: 'border-box' };
const sendBtn = (disabled: boolean): CSSProperties => ({ background: '#4B1F78', color: 'white', border: 'none', borderRadius: 10, padding: '0 18px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 });
