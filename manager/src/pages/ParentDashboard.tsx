import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function ParentDashboard() {
  const [child, setChild] = useState<any>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      api.getChildren().then(children => children?.[0] || null).catch(() => null),
      api.getNotices().catch(() => []),
      api.getFeeRecords().catch(() => []),
    ]).then(([childData, noticesData, feesData]) => {
      setChild(childData);
      setNotices((noticesData || []).slice(0, 3));
      setFeeRecords(feesData || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 40, height: 40, border: '4px solid #E5E7EB', borderTopColor: '#14B8A6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const latestFee = feeRecords?.[0];

  return (
    <div>
      <div className="page-header">
        <h2>Welcome, Parent! 👋</h2>
        <p>Here&apos;s an overview of your child at Lehakwe Daycare</p>
      </div>

      {/* Child Info Card */}
      {child ? (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #14B8A6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem',
            }}>
              👶
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px' }}>
                {child.first_name} {child.last_name}
              </h3>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: '#6B7280' }}>
                {child.age_group && <span>🎂 {child.age_group}</span>}
                {child.room && <span>🏠 {child.room}</span>}
                {child.status && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                    background: child.status === 'active' ? '#D1FAE5' : '#FEF3C7',
                    color: child.status === 'active' ? '#059669' : '#D97706',
                  }}>
                    {child.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>👶</div>
          <p style={{ color: '#6B7280' }}>No child information found</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <Link to="/attendance" className="card" style={{ textDecoration: 'none', borderLeft: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 4 }}>Attendance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>View</div>
              <div style={{ fontSize: '0.8rem', color: '#3B82F6', marginTop: 4 }}>Check Records →</div>
            </div>
            <div style={{ fontSize: '2rem', opacity: 0.8 }}>📋</div>
          </div>
        </Link>

        <Link to="/fees" className="card" style={{ textDecoration: 'none', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 4 }}>Fees Status</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {latestFee?.status === 'paid' ? '✓ Paid' : latestFee ? 'Outstanding' : 'No Fees'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#F59E0B', marginTop: 4 }}>View Fees →</div>
            </div>
            <div style={{ fontSize: '2rem', opacity: 0.8 }}>💰</div>
          </div>
        </Link>

        <Link to="/milestones" className="card" style={{ textDecoration: 'none', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 4 }}>Milestones</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>Track</div>
              <div style={{ fontSize: '0.8rem', color: '#8B5CF6', marginTop: 4 }}>View Milestones →</div>
            </div>
            <div style={{ fontSize: '2rem', opacity: 0.8 }}>🎯</div>
          </div>
        </Link>
      </div>

      {/* Recent Notices */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>📢 Recent Notices</h3>
        {notices.length === 0 ? (
          <p style={{ color: '#6B7280', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
            No recent notices
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notices.map((notice: any, i: number) => (
              <div key={i} style={{
                padding: '12px 16px', background: '#F9FAFB', borderRadius: 10,
                borderLeft: '3px solid #0B5FB3',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                  {notice.title || notice.subject}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                  {notice.content?.substring(0, 100)}{notice.content?.length > 100 ? '...' : ''}
                </div>
                {notice.created_at && (
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 6 }}>
                    {new Date(notice.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Link to="/notices" className="btn btn-secondary" style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
          View All Notices
        </Link>
      </div>
    </div>
  );
}
