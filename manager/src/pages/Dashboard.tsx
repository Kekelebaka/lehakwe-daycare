import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    staffCount: '--', childrenCount: '--', newInbox: '--', payrollStatus: 'pending',
  });
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getCompliance()])
      .then(([dash, comp]) => {
        setStats(dash);
        setCompliance((comp || []).slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Active Staff',         value: loading ? '…' : stats.staffCount,    icon: '👥', color: '#3B82F6' },
    { label: 'Active Children',      value: loading ? '…' : stats.childrenCount, icon: '👶', color: '#14B8A6' },
    { label: 'New Inbox Messages',   value: loading ? '…' : stats.newInbox,      icon: '✉️', color: '#F59E0B' },
    {
      label: 'Payroll This Month',
      value: loading ? '…' : (stats.payrollStatus === 'paid' ? 'Complete' : 'Pending'),
      icon: '💰',
      color: stats.payrollStatus === 'paid' ? '#14B8A6' : '#F97316',
    },
  ];

  const statusLabel = (s: string) =>
    s === 'complete' ? 'Complete' : s === 'needs_attention' ? 'Attention' : 'Missing';

  const statusStyle = (s: string) => ({
    fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
    background: s === 'complete' ? '#D1FAE5' : s === 'needs_attention' ? '#FEF3C7' : '#FEE2E2',
    color:      s === 'complete' ? '#059669' : s === 'needs_attention' ? '#D97706' : '#DC2626',
  });

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back. Here is your daycare at a glance.</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {cards.map((card, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${card.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{card.value}</div>
              </div>
              <div style={{ fontSize: '2rem', opacity: 0.8 }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/payslips"  className="btn btn-primary"   style={{ justifyContent: 'flex-start' }}>➕ Create Payslip</Link>
            <Link to="/staff"     className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>➕ Add Staff Member</Link>
            <Link to="/inbox"     className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📥 Open Inbox</Link>
            <Link to="/reports"   className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📑 Generate Monthly Report</Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
          {loading ? (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Loading…</p>
          ) : compliance.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>No compliance items found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {compliance.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.item_name || item.label || item.title}</span>
                  <span style={statusStyle(item.status)}>{statusLabel(item.status)}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/reports" className="btn btn-secondary" style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
            View Full Checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
