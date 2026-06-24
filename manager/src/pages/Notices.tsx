import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Notices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', pinned: false, published: true });

  useEffect(() => { api.getNotices().then(setNotices).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await api.updateNotice(editing.notice_id, form);
        setNotices(prev => prev.map(n => n.notice_id === editing.notice_id ? { ...n, ...form } : n));
      } else {
        const res = await api.createNotice({ ...form, author_id: 'admin' });
        setNotices(prev => [{ ...form, notice_id: res.id, created_at: new Date().toISOString(), author_id: 'admin' }, ...prev]);
      }
      setShowAdd(false); setEditing(null);
      setForm({ title: '', content: '', category: 'general', pinned: false, published: true });
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    await api.deleteNotice(id);
    setNotices(prev => prev.filter(n => n.notice_id !== id));
  };

  const togglePin = async (notice: any) => {
    const newPinned = !notice.pinned;
    await api.updateNotice(notice.notice_id, { pinned: newPinned });
    setNotices(prev => prev.map(n => n.notice_id === notice.notice_id ? { ...n, pinned: newPinned ? 1 : 0 } : n));
  };

  const togglePublish = async (notice: any) => {
    const newPub = !notice.published;
    await api.updateNotice(notice.notice_id, { published: newPub });
    setNotices(prev => prev.map(n => n.notice_id === notice.notice_id ? { ...n, published: newPub ? 1 : 0 } : n));
  };

  const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
    event: { bg: '#DBEAFE', text: '#2563EB', icon: '📅' },
    closure: { bg: '#FEE2E2', text: '#DC2626', icon: '🚫' },
    menu: { bg: '#D1FAE5', text: '#059669', icon: '🍽️' },
    urgent: { bg: '#FEF3C7', text: '#D97706', icon: '🚨' },
    general: { bg: '#F3F4F6', text: '#6B7280', icon: '📢' },
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Notice Board</h2>
        <p>Post notices for parents and staff</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => { setShowAdd(true); setEditing(null); setForm({ title: '', content: '', category: 'general', pinned: false, published: true }); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0B5FB3', color: 'white', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
          + New Notice
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAdd || editing) && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #0B5FB3' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>{editing ? 'Edit Notice' : 'New Notice'}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem' }} />
            <textarea placeholder="What do you want to say?" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              rows={4} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.8rem' }}>
                <option value="general">📢 General</option>
                <option value="event">📅 Event</option>
                <option value="closure">🚫 Closure</option>
                <option value="menu">🍽️ Menu</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} />
                📌 Pin to top
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} />
                ✅ Published
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0B5FB3', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                {editing ? 'Save Changes' : 'Publish'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditing(null); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notices List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notices.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📢</div>
            <div>No notices yet. Create one to get started.</div>
          </div>
        )}
        {notices.map(n => {
          const cc = categoryColors[n.category] || categoryColors.general;
          return (
            <div key={n.notice_id} className="card" style={{ borderLeft: `4px solid ${cc.text}`, opacity: n.published ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.2rem' }}>{cc.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {n.pinned ? '📌 ' : ''}{n.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                      {new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {n.author_id ? ` • by ${n.author_id}` : ''}
                    </div>
                  </div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 600, background: cc.bg, color: cc.text }}>
                  {n.category}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{n.content}</p>
              <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                <button onClick={() => togglePin(n)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: n.pinned ? '#FEF3C7' : 'white', fontSize: '0.7rem', cursor: 'pointer' }}>
                  📌 {n.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => togglePublish(n)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: n.published ? '#D1FAE5' : 'white', fontSize: '0.7rem', cursor: 'pointer' }}>
                  {n.published ? '✅ Published' : '📝 Draft'}
                </button>
                <button onClick={() => { setEditing(n); setForm({ title: n.title, content: n.content, category: n.category, pinned: !!n.pinned, published: !!n.published }); setShowAdd(false); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', fontSize: '0.7rem', cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
                <button onClick={() => handleDelete(n.notice_id)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', color: '#DC2626', fontSize: '0.7rem', cursor: 'pointer' }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
