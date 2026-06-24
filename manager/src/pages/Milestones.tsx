import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const MILESTONE_TYPES = [
  { key: '3m', label: '3 Months', age: '0-6m' },
  { key: '6m', label: '6 Months', age: '0-6m' },
  { key: '12m', label: '12 Months', age: '6-18m' },
  { key: '18m', label: '18 Months', age: '12-24m' },
  { key: '24m', label: '24 Months', age: '18-36m' },
  { key: '36m', label: '36 Months', age: '2-4y' },
  { key: '48m', label: '48 Months', age: '3-5y' },
];

const MILESTONE_CHECKLISTS: Record<string, string[]> = {
  '3m': ['Follows objects with eyes', 'Smiles socially', 'Turns head to sounds', 'Holds head steady', 'Brings hands to mouth'],
  '6m': ['Rolls over', 'Sits with support', 'Babbles consonants', 'Reaches for toys', 'Recognises familiar people'],
  '12m': ['Crawls or pulls to stand', 'Says 1-2 words', 'Follows simple instructions', 'Picks up pincer grasp', 'Waves bye-bye'],
  '18m': ['Walks independently', 'Says 5-10 words', 'Points to body parts', 'Drinks from cup', 'Stacks 2 blocks'],
  '24m': ['Runs safely', '2-3 word sentences', 'Sorts shapes/colours', 'Kicks a ball', 'Plays alongside peers'],
  '36m': ['Pedals tricycle', 'Counts to 10', 'Draws circles', 'Dresses with help', 'Plays pretend'],
  '48m': ['Hops on one foot', 'Tells a story', 'Writes some letters', 'Catches a ball', 'Follows 3-step instructions'],
};

export default function Milestones() {
  const [children, setChildren] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    Promise.all([api.getChildren(), api.getMilestones()])
      .then(([c, m]) => { setChildren(c.filter((ch: any) => ch.status === 'active')); setMilestones(m); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedChild ? milestones.filter(m => m.child_id === selectedChild) : milestones;

  const getMilestoneStatus = (childId: string, type: string) => {
    return milestones.find(m => m.child_id === childId && m.milestone_type === type);
  };

  const updateStatus = async (milestoneId: string | null, childId: string, type: string, status: string) => {
    if (milestoneId) {
      await api.updateMilestone(milestoneId, { status, achieved_date: status === 'achieved' ? new Date().toISOString().slice(0, 10) : null });
      setMilestones(prev => prev.map(m => m.milestone_id === milestoneId ? { ...m, status, achieved_date: status === 'achieved' ? new Date().toISOString().slice(0, 10) : null } : m));
    } else {
      const res = await api.createMilestone({ child_id: childId, milestone_type: type, status, achieved_date: status === 'achieved' ? new Date().toISOString().slice(0, 10) : null });
      setMilestones(prev => [...prev, { milestone_id: res.id, child_id: childId, milestone_type: type, status, achieved_date: status === 'achieved' ? new Date().toISOString().slice(0, 10) : null, child_name: children.find(c => c.child_id === childId)?.full_name }]);
    }
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    achieved: { bg: '#D1FAE5', text: '#059669' },
    pending: { bg: '#F3F4F6', text: '#6B7280' },
    delayed: { bg: '#FEE2E2', text: '#DC2626' },
    not_applicable: { bg: '#E0E7FF', text: '#4F46E5' },
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Developmental Milestones</h2>
        <p>Track each child's developmental progress</p>
      </div>

      {/* Child Selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Child</label>
        <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.9rem' }}>
          <option value="">All Children ({children.length})</option>
          {children.map(c => <option key={c.child_id} value={c.child_id}>{c.full_name} — {c.age_group}</option>)}
        </select>
      </div>

      {/* Overview Grid */}
      {!selectedChild && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Overview</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Child</th>
                  {MILESTONE_TYPES.map(t => (
                    <th key={t.key} style={{ textAlign: 'center', padding: '6px 2px', fontWeight: 600, fontSize: '0.7rem' }}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {children.map(child => (
                  <tr key={child.child_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 4px', fontWeight: 500, fontSize: '0.8rem' }}>{child.full_name}</td>
                    {MILESTONE_TYPES.map(t => {
                      const ms = getMilestoneStatus(child.child_id, t.key);
                      const st = ms?.status || 'pending';
                      const sc = statusColors[st];
                      return (
                        <td key={t.key} style={{ textAlign: 'center', padding: '6px 2px' }}>
                          <span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: 6, background: sc.bg, color: sc.text, fontSize: '0.65rem', lineHeight: '24px', fontWeight: 600 }}>
                            {st === 'achieved' ? '✓' : st === 'delayed' ? '!' : st === 'not_applicable' ? '—' : '·'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: '0.7rem', color: '#6B7280' }}>
            <span>✓ Achieved</span>
            <span>· Pending</span>
            <span style={{ color: '#DC2626' }}>! Delayed</span>
            <span>— N/A</span>
          </div>
        </div>
      )}

      {/* Child Detail View */}
      {selectedChild && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MILESTONE_TYPES.map(t => {
            const ms = getMilestoneStatus(selectedChild, t.key);
            const st = ms?.status || 'pending';
            const sc = statusColors[st];
            const checklist = MILESTONE_CHECKLISTS[t.key] || [];
            return (
              <div key={t.key} className="card" style={{ borderLeft: `4px solid ${sc.text}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.label} Milestones</div>
                    <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Expected age: {t.age}</div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: sc.bg, color: sc.text, textTransform: 'capitalize' }}>
                    {st.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {checklist.map(item => (
                    <span key={item} style={{ padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', fontSize: '0.7rem', color: '#374151' }}>
                      {item}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['achieved', 'pending', 'delayed', 'not_applicable'].map(s => (
                    <button key={s} onClick={() => updateStatus(ms?.milestone_id || null, selectedChild, t.key, s)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: st === s ? `2px solid ${statusColors[s].text}` : '1px solid #E5E7EB',
                        background: st === s ? statusColors[s].bg : 'white', color: statusColors[s].text, fontSize: '0.7rem', fontWeight: 600,
                        cursor: 'pointer', textTransform: 'capitalize' }}>
                      {s === 'achieved' ? '✓' : s === 'delayed' ? '!' : s === 'not_applicable' ? '—' : '·'} {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
