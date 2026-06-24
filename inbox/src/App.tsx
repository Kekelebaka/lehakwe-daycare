import { useState, useEffect, useCallback } from 'react';
import { api, StaffMember } from './lib/api';
import Inbox from './components/Inbox';
import ThreadView from './components/ThreadView';
import BottomNav, { Tab } from './components/BottomNav';
import ComingSoon from './components/ComingSoon';

export default function App() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('inbox');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  /* Auth */
  const loadMe = useCallback(async () => {
    try {
      setMe(await api.getMe());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not authenticated');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [loadMe]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  /* Loading screen */
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1A3D7C', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: '3rem' }}>🛡️</div>
        <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '1.1rem' }}>Lehakwe Daycare</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Loading...</div>
      </div>
    );
  }

  /* Access denied */
  if (error || !me) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1A3D7C', flexDirection: 'column', gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>Access Restricted</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', textAlign: 'center', maxWidth: 320 }}>
          {error || 'Please sign in with your Lehakwe staff email to continue.'}
        </div>
      </div>
    );
  }

  const inThread = tab === 'inbox' && threadId !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>

      {/* ── Top bar ── */}
      <div style={{
        background: '#1A3D7C', height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {inThread ? (
          <button
            onClick={() => setThreadId(null)}
            style={{
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#F59E0B',
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              fontWeight: 700, fontSize: '0.85rem',
            }}
          >
            ← Back
          </button>
        ) : (
          <span style={{ fontSize: '1.3rem' }}>🛡️</span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#F59E0B', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1 }}>
            Lehakwe Manager
          </div>
          {!inThread && (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: 1 }}>
              {me.name} · {me.role}
            </div>
          )}
        </div>

        {/* Install prompt */}
        {installPrompt && (
          <button
            onClick={handleInstall}
            style={{
              background: '#F59E0B', border: 'none', color: '#1A3D7C',
              padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
              fontWeight: 700, fontSize: '0.72rem', flexShrink: 0,
            }}
          >
            📲 Install
          </button>
        )}

        {/* Offline dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50', flexShrink: 0,
          background: online ? '#10B981' : '#EF4444',
          boxShadow: online ? '0 0 6px #10B981' : '0 0 6px #EF4444',
        }} title={online ? 'Online' : 'Offline'} />
      </div>

      {/* ── Offline banner ── */}
      {!online && (
        <div style={{
          background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
          padding: '8px 16px', textAlign: 'center',
          fontSize: '0.8rem', fontWeight: 600, color: '#92400E', flexShrink: 0,
        }}>
          📵 No connection — showing cached data. New messages will send when you reconnect.
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' } as any}>
        {tab === 'inbox' && !inThread && (
          <Inbox onOpenThread={setThreadId} currentStaffId={me.id} />
        )}
        {tab === 'inbox' && inThread && (
          <ThreadView
            threadId={threadId!}
            staffId={me.id}
            staffName={me.name}
            onBack={() => setThreadId(null)}
          />
        )}
        {tab === 'children' && <ComingSoon icon="👶" title="Children" desc="Child profiles, attendance, milestones, and document storage." />}
        {tab === 'staff' && <ComingSoon icon="👩‍💼" title="Staff" desc="Staff records, leave tracking, and UIF/PAYE management." />}
        {tab === 'payslips' && <ComingSoon icon="💰" title="Payslips" desc="Generate branded A4 payslips and track monthly payments." />}
        {tab === 'settings' && (
          <div style={{ padding: 24 }}>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20 }}>Settings</div>
            <div style={{
              background: 'white', borderRadius: 12, padding: '20px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Signed In As</div>
              <div style={{ fontWeight: 700 }}>{me.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: 2 }}>{me.email}</div>
              <div style={{
                marginTop: 8, display: 'inline-block',
                background: '#EEF2FF', color: '#3730A3',
                padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
              }}>
                {me.role}
              </div>
            </div>

            <div style={{
              background: 'white', borderRadius: 12, padding: '20px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginTop: 12,
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>System</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: '0.9rem' }}>
                <span>Official email</span><span style={{ color: '#6B7280' }}>info@lehakwedaycare.co.za</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: '0.9rem' }}>
                <span>Phone</span><span style={{ color: '#6B7280' }}>061 549 1701</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem' }}>
                <span>Connection</span>
                <span style={{ color: online ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  {online ? '✓ Online' : '✗ Offline'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'center', color: '#9CA3AF', fontSize: '0.72rem' }}>
              Lehakwe Daycare Manager v1.0<br/>
              Powered by ChiefOps AI · Ubuntu Town ECD OS
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom navigation ── */}
      <BottomNav active={inThread ? 'inbox' : tab} onSelect={t => { setTab(t); if (t !== 'inbox') setThreadId(null); }} />
    </div>
  );
}
