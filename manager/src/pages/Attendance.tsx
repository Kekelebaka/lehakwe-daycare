import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Attendance() {
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'register' | 'summary'>('register');
  const [summary, setSummary] = useState<any[]>([]);
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  useEffect(() => {
    Promise.all([api.getChildren(), api.getAttendance(date)])
      .then(([c, a]) => { setChildren(c.filter((ch: any) => ch.status === 'active')); setAttendance(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  const loadSummary = () => {
    api.getAttendanceSummary(summaryMonth, summaryYear).then(setSummary).catch(() => {});
  };

  useEffect(() => { if (view === 'summary') loadSummary(); }, [view, summaryMonth, summaryYear]);

  const getRecord = (childId: string) => attendance.find((a: any) => a.child_id === childId);

  const markAttendance = async (childId: string, status: string) => {
    const existing = getRecord(childId);
    const now = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (existing) {
      setAttendance(prev => prev.map(a => a.child_id === childId ? { ...a, status } : a));
      try { await api.updateAttendance(existing.id, { status }); } catch {}
    } else {
      const newRec = { id: `temp-${childId}`, child_id: childId, date, status, check_in_time: status !== 'absent' ? now : null, child_name: children.find(c => c.child_id === childId)?.full_name };
      setAttendance(prev => [...prev, newRec]);
      try {
        const res = await api.createAttendance({ child_id: childId, date, status, check_in_time: status !== 'absent' ? now : null });
        setAttendance(prev => prev.map(a => a.child_id === childId ? { ...a, id: res.id } : a));
      } catch {}
    }
  };

  const checkOut = async (childId: string) => {
    const existing = getRecord(childId);
    if (!existing) return;
    const now = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
    setAttendance(prev => prev.map(a => a.child_id === childId ? { ...a, check_out_time: now } : a));
    try { await api.updateAttendance(existing.id, { check_out_time: now }); } catch {}
  };

  const markAllPresent = async () => {
    setSaving(true);
    for (const child of children) {
      if (!getRecord(child.child_id)) {
        await markAttendance(child.child_id, 'present');
      }
    }
    setSaving(false);
  };

  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Attendance Tracker</h2>
        <p>Daily check-in/out for all children</p>
      </div>

      {/* View Toggle + Date Picker */}
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 2 }}>
          {(['register', 'summary'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                background: view === v ? 'white' : 'transparent', color: view === v ? '#0B5FB3' : '#6B7280',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {v === 'register' ? '📋 Daily Register' : '📊 Monthly Summary'}
            </button>
          ))}
        </div>
        {view === 'register' && (
          <>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }} />
            <button onClick={markAllPresent} disabled={saving}
              style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving...' : '✅ Mark All Present'}
            </button>
          </>
        )}
        {view === 'summary' && (
          <>
            <select value={summaryMonth} onChange={e => setSummaryMonth(Number(e.target.value))}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
            </select>
            <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.85rem' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Stats */}
      {view === 'register' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#D1FAE5', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>{presentCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>Present</div>
          </div>
          <div style={{ flex: 1, background: '#FEE2E2', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>{absentCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#DC2626' }}>Absent</div>
          </div>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>{children.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#374151' }}>Total</div>
          </div>
        </div>
      )}

      {/* Daily Register */}
      {view === 'register' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
            Register — {new Date(date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {children.map(child => {
              const rec = getRecord(child.child_id);
              const status = rec?.status || 'unmarked';
              const colors: Record<string, { bg: string; text: string; border: string }> = {
                present: { bg: '#D1FAE5', text: '#059669', border: '#059669' },
                late: { bg: '#FEF3C7', text: '#D97706', border: '#D97706' },
                absent: { bg: '#FEE2E2', text: '#DC2626', border: '#DC2626' },
                excused: { bg: '#E0E7FF', text: '#4F46E5', border: '#4F46E5' },
                unmarked: { bg: '#F9FAFB', text: '#9CA3AF', border: '#E5E7EB' },
              };
              const c = colors[status];
              return (
                <div key={child.child_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: c.bg, borderRadius: 10, border: `2px solid ${c.border}`, transition: 'all 0.2s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{child.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{child.age_group} {rec?.check_in_time ? `• In: ${rec.check_in_time}` : ''} {rec?.check_out_time ? `• Out: ${rec.check_out_time}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['present', 'late', 'absent', 'excused'].map(s => (
                      <button key={s} onClick={() => markAttendance(child.child_id, s)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: status === s ? `2px solid ${colors[s].text}` : '1px solid #E5E7EB',
                          background: status === s ? colors[s].bg : 'white', color: colors[s].text, fontSize: '0.7rem', fontWeight: 600,
                          cursor: 'pointer', textTransform: 'capitalize' }}>
                        {s === 'present' ? '✓' : s === 'late' ? '⏰' : s === 'absent' ? '✗' : '📋'} {s}
                      </button>
                    ))}
                  </div>
                  {rec?.check_in_time && !rec?.check_out_time && status !== 'absent' && (
                    <button onClick={() => checkOut(child.child_id)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F3F4F6', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Check Out
                    </button>
                  )}
                </div>
              );
            })}
            {children.length === 0 && <div style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No active children</div>}
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {view === 'summary' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
            Summary — {new Date(summaryYear, summaryMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          {summary.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6B7280', padding: 20 }}>No attendance data for this month</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Child</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px', color: '#059669' }}>Present</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px', color: '#DC2626' }}>Absent</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px', color: '#D97706' }}>Late</th>
                    <th style={{ textAlign: 'center', padding: '8px 4px' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s: any) => {
                    const rate = s.total_records > 0 ? Math.round((s.days_present / s.total_records) * 100) : 0;
                    return (
                      <tr key={s.child_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 500 }}>{s.full_name}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: '#059669', fontWeight: 600 }}>{s.days_present}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: '#DC2626', fontWeight: 600 }}>{s.days_absent}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: '#D97706', fontWeight: 600 }}>{s.days_late}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                            background: rate >= 80 ? '#D1FAE5' : rate >= 50 ? '#FEF3C7' : '#FEE2E2',
                            color: rate >= 80 ? '#059669' : rate >= 50 ? '#D97706' : '#DC2626' }}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
