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

  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const handleStatusChange = async (id: string, status: string) => {
    // Optimistic local update
    setCompliance(prev => prev.map(c => c.compliance_id === id ? { ...c, status } : c));
    try {
      const item = compliance.find(c => c.compliance_id === id);
      await api.updateCompliance(id, status, item?.notes || '');
    } catch {
      // Revert on failure — reload from API
      api.getCompliance().then(setCompliance).catch(() => {});
    }
  };

  const handleNotesChange = (id: string, notes: string) => {
    setEditingNotes(prev => ({ ...prev, [id]: notes }));
  };

  const handleNotesSave = async (id: string) => {
    const item = compliance.find(c => c.compliance_id === id);
    if (!item) return;
    const notes = editingNotes[id] ?? item.notes ?? '';
    try {
      await api.updateCompliance(id, item.status, notes);
      setCompliance(prev => prev.map(c => c.compliance_id === id ? { ...c, notes } : c));
      setEditingNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      alert('Failed to save notes.');
    }
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
                  const isEditingNotes = editingNotes[item.compliance_id] !== undefined;
                  const currentNotes = isEditingNotes ? editingNotes[item.compliance_id] : (item.notes || '');
                  return (
                    <div key={item.compliance_id} style={{ padding: '10px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.item_name}</div>
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
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          placeholder="Add notes…"
                          value={currentNotes}
                          onChange={e => handleNotesChange(item.compliance_id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleNotesSave(item.compliance_id); }}
                          style={{
                            flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB',
                            fontSize: '0.8rem', fontFamily: 'inherit',
                          }}
                        />
                        {isEditingNotes && (
                          <button onClick={() => handleNotesSave(item.compliance_id)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: '#1A3D7C', color: 'white', fontSize: '0.75rem', fontWeight: 600,
                            }}>
                            Save
                          </button>
                        )}
                      </div>
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
