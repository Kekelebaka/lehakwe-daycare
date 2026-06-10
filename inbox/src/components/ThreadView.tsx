import { useState, useEffect, useCallback } from 'react';
import { api, ThreadDetail, StaffMember, Template, Note } from '../lib/api';

interface Props {
  threadId: string;
  staffId: string;
  staffName: string;
  onBack: () => void;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'replied', label: 'Replied' },
  { value: 'closed', label: 'Closed' },
];

export default function ThreadView({ threadId, staffId, staffName, onBack }: Props) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');

  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s, tmpl] = await Promise.all([
        api.getThread(threadId),
        api.getStaff(),
        api.getTemplates(),
      ]);
      setThread(t);
      setStaff(s);
      setTemplates(tmpl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status: string) => {
    try {
      await api.updateStatus(threadId, status, staffId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleAssign = async (assignTo: string) => {
    try {
      await api.assignThread(threadId, assignTo, staffId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign');
    }
  };

  const handleSend = async (templateId?: string) => {
    if (!replyBody.trim() && !templateId) return;
    setSending(true);
    setSendResult('');
    try {
      const result = await api.sendReply(threadId, staffId, replyBody, templateId);
      setSendResult(result.sent ? '✓ Reply sent' : '⚠ Reply saved but sending may have failed');
      if (result.sent) setReplyBody('');
      await load();
    } catch (e) {
      setSendResult('✗ ' + (e instanceof Error ? e.message : 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.addNote(threadId, staffId, noteText);
      setNoteText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const applyTemplate = (tpl: Template) => {
    setReplyBody(tpl.body.replace('[SIGNATURE]', ''));
    setShowTemplates(false);
    handleSend(tpl.id);
  };

  const formatDate = (iso: string) => {
    return new Date(iso + 'Z').toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#78716C' }}>Loading thread...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 60, color: '#DC2626' }}>{error}</div>;
  if (!thread) return <div style={{ textAlign: 'center', padding: 60 }}>Thread not found.</div>;

  const firstMsg = thread.messages[0];
  const currentStatus = firstMsg?.status || 'new';
  const assignedStaff = staff.find(s => s.id === firstMsg?.assigned_to);

  return (
    <div>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{
          background: 'white', border: '1px solid #E7E5E4', borderRadius: 8,
          padding: '6px 14px', cursor: 'pointer', fontSize: '0.85rem',
        }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{firstMsg?.subject}</h2>
          <div style={{ fontSize: '0.85rem', color: '#78716C' }}>
            From: {firstMsg?.from_name} &lt;{firstMsg?.from_email}&gt;
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        background: 'white', borderRadius: 12, padding: '12px 16px',
        marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center',
        flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Status */}
        <select
          value={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #E7E5E4',
            fontSize: '0.85rem', fontWeight: 500, background: 'white', cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Assign */}
        <select
          value={firstMsg?.assigned_to || ''}
          onChange={(e) => e.target.value && handleAssign(e.target.value)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #E7E5E4',
            fontSize: '0.85rem', background: 'white', cursor: 'pointer',
          }}
        >
          <option value="">Assigned: {assignedStaff?.name || 'Unassigned'}</option>
          {staff.filter(s => s.id !== firstMsg?.assigned_to).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #E7E5E4',
              background: showNotes ? '#FEF3C7' : 'white', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            📝 Notes ({thread.notes.length})
          </button>
          <button
            onClick={() => setShowAudit(!showAudit)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #E7E5E4',
              background: showAudit ? '#FEF3C7' : 'white', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            📋 Log
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #E7E5E4',
              background: showTemplates ? '#FEF3C7' : 'white', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            📄 Templates
          </button>
        </div>
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div style={{
          background: 'white', borderRadius: 12, padding: 12, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>Reply Templates</div>
          {templates.map(tpl => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', border: 'none', background: 'transparent',
                cursor: 'pointer', borderRadius: 8, fontSize: '0.9rem',
                borderBottom: '1px solid #F5F5F4',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FFFBEB')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 600 }}>{tpl.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#78716C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tpl.body.slice(0, 100)}...
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Notes panel */}
      {showNotes && (
        <div style={{
          background: 'white', borderRadius: 12, padding: 16, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Internal Notes</div>
          {thread.notes.length === 0 && (
            <div style={{ color: '#78716C', fontSize: '0.85rem', marginBottom: 12 }}>No notes yet.</div>
          )}
          {thread.notes.map((n: Note) => (
            <div key={n.id} style={{
              background: '#FFFBEB', padding: '10px 14px', borderRadius: 8,
              marginBottom: 8, fontSize: '0.85rem',
            }}>
              <div style={{ color: '#78716C', fontSize: '0.75rem', marginBottom: 4 }}>
                {(n as any).staff_name || n.staff_id} — {formatDate(n.created_at)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{n.note}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an internal note..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                border: '1px solid #E7E5E4', fontSize: '0.85rem',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !noteText.trim()}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#F59E0B', color: 'white', fontWeight: 600,
                cursor: noteText.trim() ? 'pointer' : 'default',
                opacity: noteText.trim() ? 1 : 0.5, fontSize: '0.85rem',
              }}
            >
              {addingNote ? '...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Audit log panel */}
      {showAudit && (
        <div style={{
          background: 'white', borderRadius: 12, padding: 16, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxHeight: 300, overflowY: 'auto',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Activity Log</div>
          {thread.audit_logs.map(log => (
            <div key={log.id} style={{
              display: 'flex', gap: 10, padding: '6px 0',
              borderBottom: '1px solid #F5F5F4', fontSize: '0.8rem',
            }}>
              <span style={{ color: '#A8A29E', minWidth: 120 }}>{formatDate(log.created_at)}</span>
              <span style={{
                background: '#F1F5F9', padding: '1px 8px', borderRadius: 4,
                fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem',
              }}>
                {log.action}
              </span>
              <span style={{ color: '#78716C' }}>{(log as any).staff_name || log.staff_id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {thread.messages.map((msg) => (
          <div key={msg.id} style={{
            background: msg.direction === 'inbound' ? 'white' : '#F0FDF4',
            borderRadius: 12, padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            borderLeft: msg.direction === 'outbound' ? '3px solid #10B981' : '3px solid #F59E0B',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                {msg.direction === 'inbound' ? '📥' : '📤'} {msg.from_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#A8A29E' }}>
                {formatDate(msg.created_at)}
              </div>
            </div>
            <div style={{
              fontSize: '0.9rem', lineHeight: 1.7, color: '#44403C',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.body_text}
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div style={{
        background: 'white', borderRadius: 12, padding: 20, marginTop: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.95rem' }}>
          Reply as Lehakwe Daycare
        </div>
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder={`Write your reply...\n\nKind regards,\n\n${staffName}\nLehakwe Daycare\ninfo@lehakwedaycare.co.za`}
          rows={8}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            border: '1px solid #E7E5E4', fontSize: '0.9rem',
            fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ fontSize: '0.8rem', color: '#A8A29E' }}>
            Sending from: <strong>Lehakwe Daycare &lt;info@lehakwedaycare.co.za&gt;</strong>
          </div>
          <button
            onClick={() => handleSend()}
            disabled={sending || !replyBody.trim()}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: '#F59E0B', color: 'white', fontWeight: 700,
              cursor: replyBody.trim() ? 'pointer' : 'default',
              opacity: replyBody.trim() ? 1 : 0.5, fontSize: '0.95rem',
            }}
          >
            {sending ? 'Sending...' : 'Send Reply'}
          </button>
        </div>
        {sendResult && (
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 8,
            background: sendResult.startsWith('✓') ? '#D1FAE5' : '#FEE2E2',
            color: sendResult.startsWith('✓') ? '#059669' : '#DC2626',
            fontSize: '0.85rem', fontWeight: 500,
          }}>
            {sendResult}
          </div>
        )}
      </div>
    </div>
  );
}
