import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PageHeader, Card, Badge } from '../components/ui';

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
    { label: 'Active Staff',       value: loading ? '…' : stats.staffCount,    icon: '👥', color: '#4B1F78' },
    { label: 'Active Children',    value: loading ? '…' : stats.childrenCount, icon: '👶', color: '#0F9D8A' },
    { label: 'New Inbox Messages', value: loading ? '…' : stats.newInbox,      icon: '✉️', color: '#F7931E' },
    {
      label: 'Payroll This Month',
      value: loading ? '…' : (stats.payrollStatus === 'paid' ? 'Complete' : 'Pending'),
      icon: '💰',
      color: stats.payrollStatus === 'paid' ? '#0F9D8A' : '#F7931E',
    },
  ];

  const statusTone = (s: string): 'success' | 'warning' | 'danger' =>
    s === 'complete' ? 'success' : s === 'needs_attention' ? 'warning' : 'danger';
  const statusLabel = (s: string) =>
    s === 'complete' ? 'Complete' : s === 'needs_attention' ? 'Attention' : 'Missing';

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Welcome back. Here is your centre at a glance." />

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {cards.map((card, i) => (
          <Card key={i} accent={card.color}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Sora, sans-serif' }}>{card.value}</div>
              </div>
              <div style={{ fontSize: '2rem', opacity: 0.85 }}>{card.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid-2">
        <Card>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/payslips" className="btn btn-primary"   style={{ justifyContent: 'flex-start' }}>➕ Create Payslip</Link>
            <Link to="/staff"    className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>➕ Add Staff Member</Link>
            <Link to="/inbox"    className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📥 Open Inbox</Link>
            <Link to="/reports"  className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📑 Generate Monthly Report</Link>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
          {loading ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Loading…</p>
          ) : compliance.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>No compliance items found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {compliance.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.item_name || item.label || item.title}</span>
                  <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                </div>
              ))}
            </div>
          )}
          <Link to="/reports" className="btn btn-secondary" style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
            View Full Checklist
          </Link>
        </Card>
      </div>
    </div>
  );
}
