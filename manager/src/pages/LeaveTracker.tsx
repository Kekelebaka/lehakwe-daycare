import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave', color: '#EF4444' },
  { value: 'annual', label: 'Annual Leave', color: '#3B82F6' },
  { value: 'family', label: 'Family Responsibility', color: '#8B5CF6' },
  { value: 'other', label: 'Other', color: '#6B7280' },
];

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FEF3C7', color: '#D97706', label: 'Pending' },
  approved: { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
  rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
};

export default function LeaveTracker() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    staff_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '',
  });

  const load = () => {
    setLoading(true);
    const status = filter === 'all' ? undefined : filter;
    Promise.all([
      api.getLeaveRequests(status),
      api.getStaff(),
    ])
      .then(([l, s]) => { setLeaves(l); setStaff(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.staff_id || !form.start_date || !form.end_date) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.createLeaveRequest(form);
      setForm({ staff_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create leave request.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (leaveId: string, status: string) => {
    try {
      await api.updateLeaveRequest(leaveId, { status, approved_by: 'admin' });
      load();
    } catch {}
  };

  const handleDelete = async (leaveId: string) => {
    if (!confirm('Delete this leave request?')) return;
    try {
      await api.deleteLeaveRequest(leaveId);
      load();
    } catch {}
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #E5E7EB', fontSize: '0.9rem',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: '#374151', marginBottom: 5,
  };

  // Stats
  const pending = leaves.filter(l => l.status === 'pending').length;
  const approved = leaves.filter(l => l.status === 'approved').length;
  const rejected = leaves.filter(l => l.status === 'rejected').length;
  const upcoming = leaves.filter(l => l.status === 'approved' && l.end_date >= new Date().toISOString().slice(0, 10)).length;

  const TABS = [
    { key: 'all', label: 'All', count: leaves.length },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'approved', label: 'Approved', count: approved },
    { key: 'rejected', label: 'Rejected', count: rejected },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Leave Tracker</h2>
          <p>Manage staff leave requests and approvals.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(''); }}>
          ➕ New Leave Request
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: leaves.length, bg: '#EFF6FF', color: '#1D4ED8' },
          { label: 'Pending', value: pending, bg: '#FEF3C7', color: '#D97706' },
          { label: 'Approved', value: approved, bg: '#D1FAE5', color: '#059669' },
          { label: 'Upcoming', value: upcoming, bg: '#E0E7FF', color: '#4338CA' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: 12, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: s.color, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: '8px 16px', borderRadius: 100, border: 'none',
            background: filter === tab.key ? '#1A3D7C' : '#F3F4F6',
            color: filter === tab.key ? 'white' : '#6B7280',
            fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
          }}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Create form modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>New Leave Request</h3>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Staff Member *</label>
                  <select style={inputStyle} value={form.staff_id} onChange={e => set('staff_id', e.target.value)} required>
                    <option value="">Select staff...</option>
                    {staff.filter(s => s.active).map((s: any) => (
                      <option key={s.staff_id} value={s.staff_id}>{s.full_name} — {s.job_title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Leave Type *</label>
                  <select style={inputStyle} value={form.leave_type} onChange={e => set('leave_type', e.target.value)}>
                    {LEAVE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start Date *</label>
                    <input style={inputStyle} type="date" value={form.start_date}
                      onChange={e => set('start_date', e.target.value)} required />
                  </div>
                  <div>
                    <label style={labelStyle}>End Date *</label>
                    <input style={inputStyle} type="date" value={form.end_date}
                      onChange={e => set('end_date', e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Reason</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.reason}
                    onChange={e => set('reason', e.target.value)} placeholder="Optional reason for leave..." />
                </div>
              </div>
              {formError && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEE2E2', color: '#DC2626',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
                  {formError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="submit" disabled={saving} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: saving ? '#9CA3AF' : '#1A3D7C', color: 'white',
                  fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer',
                }}>
                  {saving ? 'Saving…' : 'Submit Request'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '12px 20px', borderRadius: 10, border: '1px solid #E5E7EB',
                  background: 'white', cursor: 'pointer', fontSize: '0.95rem',
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave request cards */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading leave requests…</p>
        ) : leaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏖️</div>
            <p>No leave requests found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {leaves.map((leave: any) => {
              const typeInfo = LEAVE_TYPES.find(t => t.value === leave.leave_type) || LEAVE_TYPES[3];
              const badge = STATUS_BADGES[leave.status] || STATUS_BADGES.pending;
              const days = Math.max(1, Math.ceil(
                (new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86400000
              ));
              return (
                <div key={leave.leave_id} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                  borderRadius: 12, border: '1px solid #F3F4F6',
                  background: leave.status === 'approved' ? '#FAFFFE' : leave.status === 'rejected' ? '#FFFBFB' : 'white',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
                    background: `${typeInfo.color}15`, flexShrink: 0,
                  }}>
                    {leave.leave_type === 'sick' ? '🤒' : leave.leave_type === 'annual' ? '🌴' : leave.leave_type === 'family' ? '👨‍👩‍👧' : '📝'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{leave.staff_name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                      {typeInfo.label} · {leave.start_date} → {leave.end_date} ({days} day{days > 1 ? 's' : ''})
                    </div>
                    {leave.reason && <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>{leave.reason}</div>}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                    background: badge.bg, color: badge.color, flexShrink: 0,
                  }}>{badge.label}</span>
                  {leave.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleStatus(leave.leave_id, 'approved')} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: '#D1FAE5', color: '#059669', fontWeight: 600,
                        fontSize: '0.78rem', cursor: 'pointer',
                      }}>✓ Approve</button>
                      <button onClick={() => handleStatus(leave.leave_id, 'rejected')} style={{
                        padding: '6px 12px', borderRadius: 8, border: 'none',
                        background: '#FEE2E2', color: '#DC2626', fontWeight: 600,
                        fontSize: '0.78rem', cursor: 'pointer',
                      }}>✕ Reject</button>
                    </div>
                  )}
                  <button onClick={() => handleDelete(leave.leave_id)} title="Delete"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '1rem', color: '#9CA3AF', padding: 4, flexShrink: 0,
                    }}>🗑️</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Calendar preview — upcoming approved leaves */}
      {upcoming > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>📅 Upcoming Leaves</h3>
          <div className="card">
            <div style={{ display: 'grid', gap: 8 }}>
              {leaves
                .filter(l => l.status === 'approved' && l.end_date >= new Date().toISOString().slice(0, 10))
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .slice(0, 5)
                .map((l: any) => (
                  <div key={l.leave_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0',
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803D' }}>
                      {l.start_date} → {l.end_date}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.85rem', color: '#374151' }}>
                      {l.staff_name} — {LEAVE_TYPES.find(t => t.value === l.leave_type)?.label || l.leave_type}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
