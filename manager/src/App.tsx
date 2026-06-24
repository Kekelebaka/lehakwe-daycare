import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { api } from './lib/api';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Payslips from './pages/Payslips';
import Staff from './pages/Staff';
import Children from './pages/Children';
import Parents from './pages/Parents';
import Reports from './pages/Reports';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import Notices from './pages/Notices';
import Milestones from './pages/Milestones';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inbox', label: 'Inbox', icon: '✉️' },
  { path: '/attendance', label: 'Attendance', icon: '📋' },
  { path: '/children', label: 'Children', icon: '👶' },
  { path: '/milestones', label: 'Milestones', icon: '🎯' },
  { path: '/fees', label: 'Fees & Finance', icon: '💰' },
  { path: '/notices', label: 'Notice Board', icon: '📢' },
  { path: '/payslips', label: 'Payslips', icon: '💸' },
  { path: '/staff', label: 'Staff', icon: '👥' },
  { path: '/parents', label: 'Parents', icon: '👨‍👩‍👧' },
  { path: '/reports', label: 'Reports', icon: '📑' },
  { path: '/documents', label: 'Documents', icon: '📁' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const BOTTOM_NAV = [
  { path: '/', label: 'Home', icon: '📊' },
  { path: '/inbox', label: 'Inbox', icon: '✉️' },
  { path: '/children', label: 'Children', icon: '👶' },
  { path: '/payslips', label: 'Payslips', icon: '💰' },
  { path: '/reports', label: 'Reports', icon: '📑' },
  { path: '__more__', label: 'More', icon: '⋯' },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser({ name: 'Admin', role: 'admin' })).finally(() => setLoading(false));
  }, []);

  // Close more menu on route change
  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  // Close more menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    if (showMore) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMore]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #E5E7EB', borderTopColor: '#0B5FB3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#6B7280', fontSize: '0.9rem' }}>Loading Lehakwe...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="app-layout">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="https://i.imgur.com/0COuhlX.png" alt="Lehakwe Daycare Logo" style={{ height: 40, width: 'auto' }} />
          <div>
            <h1>Lehakwe Manager</h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Powered by ChiefCare</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>{user?.name || 'Admin'}</div>
          <div style={{ textTransform: 'capitalize', color: '#3B82F6' }}>{user?.role || 'admin'}</div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="https://i.imgur.com/0COuhlX.png" alt="Logo" style={{ height: 32, width: 'auto' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#073B73' }}>Lehakwe Manager</div>
            <div style={{ fontSize: '0.65rem', color: '#6B7280' }}>ECD Operating System</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0B5FB3', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
            {(user?.name || 'A')[0]}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="main-content" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => {
          if (item.path === '__more__') {
            return (
              <div key="more" ref={moreRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMore(!showMore)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer',
                    color: showMore ? '#0B5FB3' : '#6B7280', fontSize: '0.65rem', fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>⋯</span>
                  <span>More</span>
                </button>
                {showMore && (
                  <div style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
                    background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: 8, minWidth: 180, zIndex: 100,
                  }}>
                    {NAV_ITEMS.filter(n => !BOTTOM_NAV.some(b => b.path === n.path)).map(n => (
                      <Link
                        key={n.path}
                        to={n.path}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 8, textDecoration: 'none', color: location.pathname === n.path ? '#0B5FB3' : '#374151',
                          fontWeight: location.pathname === n.path ? 600 : 400, fontSize: '0.85rem',
                          background: location.pathname === n.path ? '#EFF6FF' : 'transparent',
                        }}
                        onClick={() => setShowMore(false)}
                      >
                        <span>{n.icon}</span> {n.label}
                      </Link>
                    ))}
                    <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 4, paddingTop: 4 }}>
                      <Link
                        to="/settings"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 8, textDecoration: 'none', color: location.pathname === '/settings' ? '#0B5FB3' : '#374151',
                          fontSize: '0.85rem',
                        }}
                        onClick={() => setShowMore(false)}
                      >
                        <span>⚙️</span> Settings
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '6px 12px', textDecoration: 'none',
                color: isActive ? '#0B5FB3' : '#6B7280',
                fontSize: '0.65rem', fontWeight: isActive ? 600 : 500,
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile More Drawer ── */}
      {showMore && <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 90 }} />}

      <style>{`
        .mobile-header { display: none; }
        .bottom-nav { display: none; }
        @media (max-width: 767px) {
          .app-layout { flex-direction: column; }
          .sidebar { display: none !important; }
          .mobile-header {
            display: flex !important;
            align-items: center; justify-content: space-between;
            padding: 12px 16px;
            background: white; border-bottom: 1px solid #E5E7EB;
            position: sticky; top: 0; z-index: 50;
          }
          .bottom-nav {
            display: flex !important;
            align-items: center; justify-content: space-around;
            position: fixed; bottom: 0; left: 0; right: 0;
            background: white; border-top: 1px solid #E5E7EB;
            padding: 4px 0 calc(4px + env(safe-area-inset-bottom, 0px));
            z-index: 50;
          }
          .main-content { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/children" element={<Children />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/payslips" element={<Payslips />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/parents" element={<Parents />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
