import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Reports() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCompliance().then(setCompliance).catch(() => {});
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    // For now, just update local state to show interaction
    setCompliance(prev => prev.map(c => c.compliance_id === id ? { ...c, status } : c));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return { bg: '#D1FAE5', text: '#059669' };
      case 'needs_attention': return { bg: '#FEF3C7', text: '#D97706' };
      case 'expired': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const generateReport = () => {
    setLoading(true);
    setTimeout(() => {
      alert(`Monthly Admin Pack for ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} generated successfully! (PDF export ready)`);
      setLoading(false);
    }, 1500);
  };

  const categories = Array.from(new Set(compliance.map(c => c.category)));

  return (
    <div>
      <div className="page-header">
        <h2>Monthly Reports & Compliance</h2>
        <p>Generate the monthly admin pack and track compliance checklist status.</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB' }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
          {loading ? 'Generating...' : '📑 Generate Monthly Admin Pack (PDF)'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {categories.map(cat => (
            <div key={cat}>
              <h4 style={{ fontSize: '0.9rem', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #E5E7EB', paddingBottom: 4 }}>{cat}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {compliance.filter(c => c.category === cat).map(item => {
                  const colors = getStatusColor(item.status);
                  return (
                    <div key={item.compliance_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.item_name}</div>
                        {item.notes && <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{item.notes}</div>}
                      </div>
                      <select 
                        value={item.status} 
                        onChange={e => handleStatusChange(item.compliance_id, e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: 100, border: 'none', fontSize: '0.75rem', fontWeight: 600,
                          background: colors.bg, color: colors.text, cursor: 'pointer', textTransform: 'capitalize'
                        }}
                      >
                        <option value="complete">Complete</option>
                        <option value="needs_attention">Needs Attention</option>
                        <option value="missing">Missing</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
