import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../lib/api';
import { PageHeader, Badge } from '../components/ui';

// Ubuntu Compliance Score — overall + per-category readiness, with inline
// status controls that update each item and recompute the score.
const STATUSES = ['complete', 'needs_attention', 'missing', 'expired'];
const tone: Record<string, any> = { complete: 'success', needs_attention: 'warning', missing: 'neutral', expired: 'danger' };
const ringColor = (s: number) => (s >= 80 ? '#0F9D8A' : s >= 50 ? '#F7931E' : '#DC2626');

export default function Compliance() {
  const [score, setScore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState('');

  const load = () => {
    api.getComplianceScore().then(setScore).catch(() => {});
    api.getCompliance().then(setItems).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (item: any, status: string) => {
    setSaving(item.compliance_id);
    try { await api.updateCompliance(item.compliance_id, status, item.notes || ''); load(); }
    finally { setSaving(''); }
  };

  const deg = score ? Math.round((score.score / 100) * 360) : 0;
  const cats: string[] = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div>
      <PageHeader title="Compliance" subtitle="Your Ubuntu Compliance Score — stay inspection-ready and funder-ready." />

      <div style={{ ...card, marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 108, height: 108, borderRadius: '50%', flexShrink: 0, background: score ? `conic-gradient(${ringColor(score.score)} ${deg}deg, #EEE ${deg}deg)` : '#EEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 82, height: 82, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: '#102A43' }}>{score ? `${score.score}%` : '—'}</div>
            <div style={{ fontSize: '0.6rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Compliant</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontWeight: 800, color: '#102A43', marginBottom: 4 }}>Ubuntu Compliance Score</div>
          <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 12 }}>{score ? `${score.complete} of ${score.total} items complete · ${score.attention} need attention` : 'Loading…'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {(score?.categories || []).map((cat: any) => (
              <div key={cat.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#374151', marginBottom: 3 }}><span>{cat.category}</span><span>{cat.score}%</span></div>
                <div style={{ height: 8, borderRadius: 999, background: '#EFEAF7', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${cat.score}%`, background: ringColor(cat.score) }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cats.map((category) => (
        <div key={category} style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, color: '#102A43', marginBottom: 10 }}>{category}</div>
          {items.filter((i) => i.category === category).map((it) => (
            <div key={it.compliance_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span>{it.status === 'complete' ? '✅' : it.status === 'expired' ? '⏰' : it.status === 'needs_attention' ? '⚠️' : '⬜'}</span>
                <span style={{ fontSize: '0.9rem', color: '#14213A' }}>{it.item_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Badge tone={tone[it.status] || 'neutral'}>{it.status.replace('_', ' ')}</Badge>
                <select value={it.status} disabled={saving === it.compliance_id} onChange={(e) => setStatus(it, e.target.value)} style={sel}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const card: CSSProperties = { background: '#fff', border: '1px solid #E7E3F0', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(16,42,67,0.06)' };
const sel: CSSProperties = { padding: '5px 8px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.8rem', background: '#fff' };
