import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  waiting: { bg: '#FEF3C7', color: '#D97706', label: 'Waiting' },
  contacted: { bg: '#DBEAFE', color: '#2563EB', label: 'Contacted' },
  enrolled: { bg: '#D1FAE5', color: '#059669', label: 'Enrolled' },
  withdrawn: { bg: '#F3F4F6', color: '#6B7280', label: 'Withdrawn' },
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.getWaitlist()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.updateWaitlistEntry(id, { status });
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this waitlist entry?')) return;
    try {
      await api.deleteWaitlistEntry(id);
      load();
    } catch {}
  };

  const handleContact = (entry: any) => {
    if (entry.parent_phone) {
      window.open(`tel:${entry.parent_phone}`, '_self');
    } else if (entry.parent_email) {
      window.open(`mailto:${entry.parent_email}`, '_self');
    }
  };

  const handleMoveToEnroll = async (entry: any) => {
    if (!confirm(`Move ${entry.child_name} to enrollment? This will redirect to the Children page.`)) return;
    try {
      await api.updateWaitlistEntry(entry.waitlist_id, { status: 'enrolled' });
      navigate('/children');
    } catch {}
  };

  // Stats
  const waiting = entries.filter(e => e.status === 'waiting').length;
  const contacted = entries.filter(e => e.status === 'contacted').length;
  const enrolled = entries.filter(e => e.status === 'enrolled').length;

  return (
    <div>
      <div className="page-header">
        <h2>Waitlist</h2>
        <p>Manage the waiting list for enrollment.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: entries.length, bg: '#EFF6FF', color: '#1D4ED8' },
          { label: 'Waiting', value: waiting, bg: '#FEF3C7', color: '#D97706' },
          { label: 'Contacted', value: contacted, bg: '#DBEAFE', color: '#2563EB' },
          { label: 'Enrolled', value: enrolled, bg: '#D1FAE5', color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: 12, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: s.color, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Entry cards */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading waitlist…</p>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
            <p>No entries on the waitlist.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {entries.map((entry: any) => {
              const badge = STATUS_BADGES[entry.status] || STATUS_BADGES.waiting;
              return (
                <div key={entry.waitlist_id} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                  borderRadius: 12, border: '1px solid #F3F4F6', background: 'white',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                    background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, flexShrink: 0,
                  }}>
                    {entry.position || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {entry.child_name}
                      {entry.age_group && (
                        <span style={{ fontSize: '0.78rem', color: '#6B7280', marginLeft: 8, fontWeight: 400 }}>
                          ({entry.age_group})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: 2 }}>
                      Parent: {entry.parent_name || '—'}
                      {entry.parent_phone && <span> · 📞 {entry.parent_phone}</span>}
                      {entry.parent_email && <span> · ✉️ {entry.parent_email}</span>}
                    </div>
                    {entry.preferred_start_date && (
                      <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>
                        Preferred start: {entry.preferred_start_date}
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' }}>
                        {entry.notes}
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: '#D1D5DB', marginTop: 2 }}>
                      Added: {entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-ZA') : '—'}
                    </div>
                  </div>

                  <span style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                    background: badge.bg, color: badge.color, flexShrink: 0,
                  }}>{badge.label}</span>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(entry.status === 'waiting' || entry.status === 'contacted') && (
                      <>
                        <button onClick={() => handleContact(entry)} title="Contact parent"
                          style={{
                            padding: '6px 10px', borderRadius: 8, border: 'none',
                            background: '#DBEAFE', color: '#2563EB', fontWeight: 600,
                            fontSize: '0.78rem', cursor: 'pointer',
                          }}>📞 Contact</button>
                        <button onClick={() => handleMoveToEnroll(entry)} title="Move to enrollment"
                          style={{
                            padding: '6px 10px', borderRadius: 8, border: 'none',
                            background: '#D1FAE5', color: '#059669', fontWeight: 600,
                            fontSize: '0.78rem', cursor: 'pointer',
                          }}>✅ Enroll</button>
                      </>
                    )}
                    {entry.status === 'waiting' && (
                      <button onClick={() => handleStatus(entry.waitlist_id, 'contacted')} title="Mark contacted"
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: 'none',
                          background: '#FEF3C7', color: '#D97706', fontWeight: 600,
                          fontSize: '0.78rem', cursor: 'pointer',
                        }}>📧 Contacted</button>
                    )}
                    <button onClick={() => handleDelete(entry.waitlist_id)} title="Delete"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1rem', color: '#9CA3AF', padding: 4,
                      }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
