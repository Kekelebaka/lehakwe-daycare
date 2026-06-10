import { useState, useEffect, useCallback } from 'react';
import { api, StaffMember } from './lib/api';
import Inbox from './components/Inbox';
import ThreadView from './components/ThreadView';

type Page = 'inbox' | 'thread';

export default function App() {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState<Page>('inbox');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const staff = await api.getMe();
      setMe(staff);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not authenticated');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const openThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setPage('thread');
  };

  const backToInbox = () => {
    setActiveThreadId(null);
    setPage('inbox');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🌻</div>
          <div style={{ fontSize: '1rem', color: '#78716C' }}>Loading Lehakwe Inbox...</div>
        </div>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
          <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
          <p style={{ color: '#78716C' }}>{error || 'Please sign in with your staff email to access the Lehakwe Daycare inbox.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', fontFamily: 'system-ui' }}>
      <header style={{
        background: 'white', borderBottom: '1px solid #E7E5E4',
        padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>🌻</span>
          <strong style={{ color: '#D97706' }}>Lehakwe Inbox</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.875rem', color: '#78716C' }}>
          <span>{me.name}</span>
          <span style={{
            background: '#FEF3C7', color: '#D97706', padding: '2px 10px',
            borderRadius: 100, fontSize: '0.75rem', fontWeight: 600
          }}>
            {me.role}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        {page === 'inbox' && (
          <Inbox onOpenThread={openThread} currentStaffId={me.id} />
        )}
        {page === 'thread' && activeThreadId && (
          <ThreadView
            threadId={activeThreadId}
            staffId={me.id}
            staffName={me.name}
            onBack={backToInbox}
          />
        )}
      </main>
    </div>
  );
}
