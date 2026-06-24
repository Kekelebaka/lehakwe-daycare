import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  present: { bg: '#D1FAE5', text: '#059669' },
  absent: { bg: '#FEE2E2', text: '#DC2626' },
  late: { bg: '#FEF3C7', text: '#D97706' },
  excused: { bg: '#DBEAFE', text: '#2563EB' },
};

const CATEGORY_ICONS: Record<string, string> = {
  event: '📅', closure: '🚫', menu: '🍽️', urgent: '🚨', general: '📢',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ParentPortal() {
  const { childId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'notices' | 'attendance' | 'fees'>('notices');

  useEffect(() => {
    if (!childId) { setError('No child ID'); setLoading(false); return; }
    fetch(`${API_BASE}/public/child/${childId}`)
      .then(r => r.json())
      .then(json => {
        if (!json.ok) throw new Error(json.error);
        setData(json.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F9FF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#0B5FB3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ marginTop: 16, color: '#6B7280', fontSize: '0.9rem' }}>Loading...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F0F9FF', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
      <h2 style={{ color: '#DC2626', marginBottom: 8 }}>Child Not Found</h2>
      <p style={{ color: '#6B7280', textAlign: 'center' }}>{error}</p>
    </div>
  );

  const { child, attendance, fees, notices, settings, balance } = data;

  const attendanceDays = attendance.length;
  const presentDays = attendance.filter((a: any) => a.status === 'present').length;
  const attendanceRate = attendanceDays > 0 ? Math.round((presentDays / attendanceDays) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F0F9FF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B5FB3, #073B73)', color: 'white', padding: '24px 16px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {settings?.centre_name || 'Lehakwe Daycare'}
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{child.full_name}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>
          {child.age_group} • {child.parent_name}
        </div>
        {child.allergies && (
          <div style={{ marginTop: 8, padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 100, fontSize: '0.75rem', display: 'inline-block' }}>
            ⚠️ {child.allergies}
          </div>
        )}
      </div>

      {/* Balance Card */}
      <div style={{ margin: '16px 16px 0', padding: 16, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase' }}>Outstanding Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: balance.outstanding > 0 ? '#DC2626' : '#059669' }}>
              R{balance.outstanding.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Paid this year</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#059669' }}>R{balance.total_paid.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <div style={{ margin: '12px 16px 0', padding: 16, background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 }}>Attendance This Month</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0B5FB3' }}>{attendanceRate}%</span>
          <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>{presentDays}/{attendanceDays} days</span>
        </div>
        <div style={{ marginTop: 8, height: 6, background: '#E5E7EB', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${attendanceRate}%`, background: attendanceRate >= 80 ? '#059669' : attendanceRate >= 50 ? '#D97706' : '#DC2626', borderRadius: 3, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ margin: '16px 16px 0', display: 'flex', gap: 4, background: 'white', borderRadius: 10, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {[
          { key: 'notices', label: '📢 Notices', count: notices.length },
          { key: 'attendance', label: '📋 Attendance', count: attendanceDays },
          { key: 'fees', label: '💰 Fees', count: fees.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
              background: activeTab === tab.key ? '#EFF6FF' : 'transparent',
              color: activeTab === tab.key ? '#0B5FB3' : '#6B7280' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '12px 16px 24px' }}>
        {/* NOTICES TAB */}
        {activeTab === 'notices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notices.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No notices yet</div>
            )}
            {notices.map((n: any) => (
              <div key={n.notice_id} style={{ background: 'white', padding: 14, borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)', borderLeft: `3px solid ${n.category === 'urgent' ? '#DC2626' : n.category === 'closure' ? '#F59E0B' : '#0B5FB3'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{CATEGORY_ICONS[n.category] || '📢'}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{n.pinned ? '📌 ' : ''}{n.title}</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>
                    {new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5, margin: 0 }}>{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div>
            {attendance.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', background: 'white', borderRadius: 10 }}>No attendance records this month</div>
            ) : (
              <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden' }}>
                {attendance.map((a: any) => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.present;
                  return (
                    <div key={a.record_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {new Date(a.date).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        {a.check_in_time && (
                          <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                            In: {a.check_in_time}{a.check_out_time ? ` • Out: ${a.check_out_time}` : ''}
                          </div>
                        )}
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text, textTransform: 'capitalize' }}>
                        {a.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FEES TAB */}
        {activeTab === 'fees' && (
          <div>
            {fees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', background: 'white', borderRadius: 10 }}>No fee records yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fees.map((f: any) => {
                  const isPaid = f.status === 'paid';
                  const isPartial = f.status === 'partial';
                  return (
                    <div key={f.fee_id} style={{ background: 'white', padding: 14, borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{MONTHS[f.month - 1]} {f.year}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 600,
                          background: isPaid ? '#D1FAE5' : isPartial ? '#FEF3C7' : '#FEE2E2',
                          color: isPaid ? '#059669' : isPartial ? '#D97706' : '#DC2626', textTransform: 'capitalize' }}>
                          {f.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#6B7280' }}>Due: R{f.amount_due?.toLocaleString()}</span>
                        <span style={{ color: f.amount_paid > 0 ? '#059669' : '#6B7280' }}>Paid: R{f.amount_paid?.toLocaleString()}</span>
                      </div>
                      {f.payment_method && (
                        <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 4 }}>
                          Via {f.payment_method}{f.payment_date ? ` • ${f.payment_date}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '16px', color: '#9CA3AF', fontSize: '0.7rem', borderTop: '1px solid #E5E7EB' }}>
        {settings?.centre_name || 'Lehakwe Daycare'} • NPO {settings?.npo_number || '22910695'}
        <br />
        <a href={`https://wa.me/276****1701?text=Hi%20Lehakwe%20Daycare%2C%20I'm%20enquiring%20about%20${encodeURIComponent(child.full_name)}`}
          style={{ color: '#0B5FB3', textDecoration: 'none', fontWeight: 600 }}>
          💬 WhatsApp Us
        </a>
      </div>
    </div>
  );
}
