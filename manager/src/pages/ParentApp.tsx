import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { parentApi } from '../lib/api';
import { Brand } from '../components/ui';

export default function ParentApp() {
  const [me, setMe] = useState<any>(null);
  const [childId, setChildId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    parentApi.me()
      .then((j) => {
        if (!j.ok) { window.location.href = '/parent-login'; return; }
        setMe(j.data);
        const first = j.data.children?.[0];
        if (first) setChildId(first.child_id); else setLoading(false);
      })
      .catch(() => { window.location.href = '/parent-login'; });
  }, []);

  useEffect(() => {
    if (!childId) return;
    setLoading(true);
    parentApi.child(childId).then((j) => { if (j.ok) setData(j.data); }).finally(() => setLoading(false));
  }, [childId]);

  const doLogout = async () => { try { await parentApi.logout(); } catch { /* ignore */ } window.location.href = '/parent-login'; };

  if (!me) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading…</div>;

  const child = data?.child;
  const attendance: any[] = data?.attendance || [];
  const media: any[] = data?.media || [];
  const notices: any[] = data?.notices || [];
  const balance = data?.balance || { outstanding: 0, total_paid: 0 };
  const present = attendance.filter((a) => a.status === 'present').length;
  const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6FB', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 32 }}>
      <div style={{ background: 'linear-gradient(135deg, #4B1F78, #37155C)', color: 'white', padding: '18px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand size="sm" onDark />
          <button onClick={doLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer' }}>Sign out</button>
        </div>
        <div style={{ marginTop: 12, fontSize: '0.82rem', opacity: 0.9 }}>Hi {me.parent?.name || 'there'} 👋</div>
      </div>

      {me.children?.length > 1 && (
        <div style={{ padding: '12px 16px 0' }}>
          <select value={childId} onChange={(e) => setChildId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: '0.9rem', width: '100%' }}>
            {me.children.map((c: any) => <option key={c.child_id} value={c.child_id}>{c.full_name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading…</div>
      ) : !child ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>No child is linked to your account yet. Please contact the centre.</div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#14213A' }}>{child.full_name}</div>
          <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 16 }}>{child.age_group}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={cardS}><div style={capS}>Outstanding</div><div style={{ fontSize: '1.4rem', fontWeight: 800, color: balance.outstanding > 0 ? '#DC2626' : '#0F9D8A' }}>R{Number(balance.outstanding).toLocaleString()}</div></div>
            <div style={cardS}><div style={capS}>Attendance (mo)</div><div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4B1F78' }}>{rate}%</div></div>
          </div>

          <div style={{ ...cardS, marginBottom: 16 }}>
            <div style={{ ...capS, marginBottom: 10 }}>📷 Recent photos</div>
            {media.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>No photos yet — check back soon.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                {media.map((m) => <img key={m.media_id} src={parentApi.mediaUrl(m.media_id)} alt={m.caption || 'Photo'} loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10, background: '#EEE' }} />)}
              </div>
            )}
          </div>

          <div style={cardS}>
            <div style={{ ...capS, marginBottom: 10 }}>📢 Notices</div>
            {notices.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>No notices.</div>
            ) : (
              notices.slice(0, 5).map((n) => (
                <div key={n.notice_id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{n.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{n.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: 16, fontSize: '0.7rem', color: '#9CA3AF' }}>Ubuntu Daycare OS · Powered by ChiefOps</div>
    </div>
  );
}

const cardS: CSSProperties = { background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const capS: CSSProperties = { fontSize: '0.72rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' };
