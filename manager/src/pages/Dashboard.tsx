import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    staffCount: 2,
    childrenCount: 15,
    newInbox: 3,
    payrollStatus: 'pending',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, fetch from /api/dashboard
    // For MVP, we show placeholders that update as data is added
    setLoading(false);
  }, []);

  const cards = [
    { label: 'Active Staff', value: stats.staffCount, icon: '👥', color: '#3B82F6' },
    { label: 'Active Children', value: stats.childrenCount, icon: '👶', color: '#14B8A6' },
    { label: 'New Inbox Messages', value: stats.newInbox, icon: '✉️', color: '#F59E0B' },
    { label: 'Payroll This Month', value: stats.payrollStatus === 'paid' ? 'Complete' : 'Pending', icon: '💰', color: stats.payrollStatus === 'paid' ? '#14B8A6' : '#F97316' },
  ];

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
            <a href="/payslips" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>➕ Create Payslip</a>
            <a href="/staff" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>➕ Add Staff Member</a>
            <a href="/inbox" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📥 Open Inbox</a>
            <a href="/reports" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📑 Generate Monthly Report</a>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Centre Registration', status: 'needs_attention' },
              { label: 'Staff Contracts', status: 'missing' },
              { label: 'Child Registration Forms', status: 'missing' },
              { label: 'Payslip Records', status: 'complete' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                  background: item.status === 'complete' ? '#D1FAE5' : item.status === 'needs_attention' ? '#FEF3C7' : '#FEE2E2',
                  color: item.status === 'complete' ? '#059669' : item.status === 'needs_attention' ? '#D97706' : '#DC2626',
                }}>
                  {item.status === 'complete' ? 'Complete' : item.status === 'needs_attention' ? 'Attention' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
          <a href="/reports" className="btn btn-secondary" style={{ marginTop: 16, width: '100%' }}>View Full Checklist</a>
        </div>
      </div>
    </div>
  );
}
