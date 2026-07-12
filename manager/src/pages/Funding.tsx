import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../lib/api';
import { PageHeader, Button, Badge } from '../components/ui';

// Ubuntu Funding Navigator — Discovery (match score), Readiness score,
// Pipeline (funding CRM), and the AI Application Builder.
const SECTIONS = [
  ['cover_letter', 'Cover letter'],
  ['organisation_profile', 'Org profile'],
  ['motivation', 'Motivation'],
  ['project_proposal', 'Proposal'],
  ['budget', 'Budget'],
  ['impact_statement', 'Impact'],
] as const;

const STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'received'];
const rands = (n: any) => (n == null ? '—' : `R${Number(n).toLocaleString()}`);
const catTone: Record<string, any> = { government: 'brand', lottery: 'warning', foundation: 'success', ngo: 'neutral', csi: 'neutral' };
const statusTone: Record<string, any> = { approved: 'success', received: 'success', rejected: 'danger', submitted: 'brand', under_review: 'warning', draft: 'neutral' };

export default function Funding() {
  const [readiness, setReadiness] = useState<any>(null);
  const [opps, setOpps] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [open, setOpen] = useState<string>('');   // expanded application id
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState('');

  const loadApps = () => api.getFundingApplications().then(setApps).catch(() => {});
  useEffect(() => {
    api.getFundingReadiness().then(setReadiness).catch(() => {});
    api.getFundingOpportunities().then(setOpps).catch(() => {});
    loadApps();
  }, []);

  const startApp = async (o: any) => {
    setBusy('opp-' + o.opportunity_id); setFlash('');
    try {
      await api.createFundingApplication({ opportunity_id: o.opportunity_id, title: `${o.name} — application`, amount_requested: o.max_amount || undefined });
      setFlash(`Started an application for “${o.name}”. Scroll to Pipeline to build it with AI.`);
      await loadApps();
    } catch (e: any) { setFlash(e.message || 'Could not start application.'); } finally { setBusy(''); }
  };
  const setStatus = async (a: any, status: string) => { await api.updateFundingApplication(a.application_id, { status }); loadApps(); };
  const del = async (a: any) => { await api.deleteFundingApplication(a.application_id); loadApps(); };
  const generate = async (a: any, section: string) => {
    setBusy(`${a.application_id}:${section}`); setFlash('');
    try {
      const r = await api.generateFundingSection(a.application_id, section);
      setApps((prev) => prev.map((x) => x.application_id === a.application_id ? { ...x, content: r.content } : x));
    } catch (e: any) { setFlash(e.message || 'AI generation failed.'); } finally { setBusy(''); }
  };

  const ringDeg = readiness ? Math.round((readiness.score / 100) * 360) : 0;

  return (
    <div>
      <PageHeader title="Funding Navigator" subtitle="Find funding you qualify for, get application-ready, and build submission packs with AI." />
      {flash && <div style={flashS}>{flash}</div>}

      {/* Readiness */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 104, height: 104, borderRadius: '50%', flexShrink: 0, background: readiness ? `conic-gradient(var(--brand-teal,#0F9D8A) ${ringDeg}deg, #EEE ${ringDeg}deg)` : '#EEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: '#102A43' }}>{readiness ? `${readiness.score}%` : '—'}</div>
              <div style={{ fontSize: '0.6rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ready</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 800, color: '#102A43', fontSize: '1.05rem', marginBottom: 8 }}>Funding readiness</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '4px 16px' }}>
              {(readiness?.items || []).map((it: any) => (
                <div key={it.key} style={{ fontSize: '0.85rem', color: it.done ? '#14213A' : '#9CA3AF', display: 'flex', gap: 8 }}>
                  <span>{it.done ? '✅' : '⬜'}</span>{it.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Discovery */}
      <h3 style={h3}>Matched opportunities</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 26 }}>
        {opps.map((o) => (
          <div key={o.opportunity_id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#102A43' }}>{o.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>{o.funder}</div>
              </div>
              <span style={matchBadge(o.match_score)}>{o.match_score}%</span>
            </div>
            <div style={{ fontSize: '0.84rem', color: '#5B6B82', margin: '8px 0' }}>{o.description}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <Badge tone={catTone[o.category] || 'neutral'}>{o.category}</Badge>
              <span style={meta}>{rands(o.min_amount)}–{rands(o.max_amount)}</span>
              <span style={meta}>· {o.deadline}</span>
            </div>
            <Button variant="primary" onClick={() => startApp(o)} disabled={busy === 'opp-' + o.opportunity_id}>
              {busy === 'opp-' + o.opportunity_id ? 'Starting…' : 'Start application'}
            </Button>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <h3 style={h3}>Funding pipeline</h3>
      {apps.length === 0 ? (
        <div style={{ ...card, color: '#9CA3AF', fontSize: '0.9rem' }}>No applications yet. Start one from a matched opportunity above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {apps.map((a) => (
            <div key={a.application_id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: '#102A43' }}>{a.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>{a.funder || 'Custom'}{a.deadline ? ` · due ${a.deadline}` : ''} · asked {rands(a.amount_requested)}{a.amount_awarded ? ` · awarded ${rands(a.amount_awarded)}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge tone={statusTone[a.status] || 'neutral'}>{a.status.replace('_', ' ')}</Badge>
                  <select value={a.status} onChange={(e) => setStatus(a, e.target.value)} style={sel}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#6B7280', marginRight: 4 }}>Build with AI:</span>
                {SECTIONS.map(([key, label]) => (
                  <button key={key} onClick={() => generate(a, key)} disabled={busy === `${a.application_id}:${key}`} style={aiBtn(busy === `${a.application_id}:${key}`)}>
                    {busy === `${a.application_id}:${key}` ? '…' : label}
                  </button>
                ))}
                <button onClick={() => setOpen(open === a.application_id ? '' : a.application_id)} style={linkBtn}>{open === a.application_id ? 'Hide' : 'View pack'}</button>
                <button onClick={() => del(a)} style={{ ...linkBtn, color: '#DC2626' }}>Delete</button>
              </div>
              {open === a.application_id && (
                <textarea readOnly value={a.content || 'No content yet — click a section above to generate it with AI.'} style={packArea} />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.72rem', marginTop: 20 }}>Ubuntu Funding Navigator · Powered by ChiefOps</div>
    </div>
  );
}

const card: CSSProperties = { background: '#fff', border: '1px solid #E7E3F0', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(16,42,67,0.06)' };
const h3: CSSProperties = { fontFamily: 'Sora, sans-serif', color: '#102A43', fontSize: '1.05rem', margin: '4px 0 12px' };
const flashS: CSSProperties = { background: '#F5F1FB', border: '1px solid #E4D9F3', color: '#4B1F78', borderRadius: 10, padding: '10px 14px', margin: '0 0 16px', fontSize: '0.86rem' };
const meta: CSSProperties = { fontSize: '0.76rem', color: '#6B7280' };
const sel: CSSProperties = { padding: '6px 8px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: '0.8rem', background: '#fff' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: '#4B1F78', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, padding: '4px 6px' };
const packArea: CSSProperties = { width: '100%', minHeight: 200, marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid #E5E7EB', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', lineHeight: 1.5, boxSizing: 'border-box', whiteSpace: 'pre-wrap' };
const matchBadge = (score: number): CSSProperties => ({ flexShrink: 0, fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#fff', borderRadius: 10, padding: '4px 10px', background: score >= 80 ? '#0F9D8A' : score >= 60 ? '#F7931E' : '#9CA3AF' });
const aiBtn = (loading: boolean): CSSProperties => ({ background: '#F3EFFA', color: '#4B1F78', border: '1px solid #E4D9F3', borderRadius: 999, padding: '5px 11px', fontSize: '0.78rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer' });
