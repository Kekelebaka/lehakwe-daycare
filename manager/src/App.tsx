import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { api, getToken, getStoredUser, clearToken } from './lib/api';
import LoginPage from './pages/LoginPage';
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
import AIAssistant from './pages/AIAssistant';
import ParentPortal from './pages/ParentPortal';
import DailyLogs from './pages/DailyLogs';
import LeaveTracker from './pages/LeaveTracker';
import WaitlistPage from './pages/WaitlistPage';
import ParentDashboard from './pages/ParentDashboard';
import RoleSelector from './components/RoleSelector';

// ── Role Types & Context ──
export type UserRole = 'admin' | 'staff' | 'parent';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
}

export const RoleContext = createContext<RoleContextType>({
  role: 'admin',
  setRole: () => {},
  clearRole: () => {},
});

export const useRole = () => useContext(RoleContext);

// ── Role-based nav definitions ──
const ADMIN_NAV = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inbox', label: 'Inbox', icon: '✉️' },
  { path: '/attendance', label: 'Attendance', icon: '📋' },
  { path: '/daily-logs', label: 'Daily Logs', icon: '📝' },
  { path: '/children', label: 'Children', icon: '👶' },
  { path: '/milestones', label: 'Milestones', icon: '🎯' },
  { path: '/fees', label: 'Fees & Finance', icon: '💰' },
  { path: '/notices', label: 'Notice Board', icon: '📢' },
  { path: '/ai', label: 'AI Assistant', icon: '🤖' },
  { path: '/leave', label: 'Leave Tracker', icon: '🏖️' },
  { path: '/waitlist', label: 'Waitlist', icon: '📋' },
  { path: '/payslips', label: 'Payslips', icon: '💸' },
  { path: '/staff', label: 'Staff', icon: '👥' },
  { path: '/parents', label: 'Parents', icon: '👨‍👩‍👧' },
  { path: '/reports', label: 'Reports', icon: '📑' },
  { path: '/documents', label: 'Documents', icon: '📁' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const STAFF_NAV = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/attendance', label: 'Attendance', icon: '📋' },
  { path: '/daily-logs', label: 'Daily Logs', icon: '📝' },
  { path: '/inbox', label: 'Inbox', icon: '✉️' },
  { path: '/payslips', label: 'Payslips', icon: '💸' },
  { path: '/notices', label: 'Notice Board', icon: '📢' },
];

const PARENT_NAV = [
  { path: '/', label: 'My Child', icon: '👶' },
  { path: '/attendance', label: 'Attendance', icon: '📋' },
  { path: '/fees', label: 'Fees', icon: '💰' },
  { path: '/notices', label: 'Notices', icon: '📢' },
  { path: '/milestones', label: 'Milestones', icon: '🎯' },
];

const ROLE_NAV_MAP: Record<UserRole, typeof ADMIN_NAV> = {
  admin: ADMIN_NAV,
  staff: STAFF_NAV,
  parent: PARENT_NAV,
};

// ── Bottom Nav per role ──
const ROLE_BOTTOM_NAV: Record<UserRole, { path: string; label: string; icon: string }[]> = {
  admin: [
    { path: '/', label: 'Home', icon: '📊' },
    { path: '/inbox', label: 'Inbox', icon: '✉️' },
    { path: '/children', label: 'Children', icon: '👶' },
    { path: '/payslips', label: 'Payslips', icon: '💰' },
    { path: '/reports', label: 'Reports', icon: '📑' },
  ],
  staff: [
    { path: '/', label: 'Home', icon: '📊' },
    { path: '/attendance', label: 'Attendance', icon: '📋' },
    { path: '/daily-logs', label: 'Logs', icon: '📝' },
    { path: '/inbox', label: 'Inbox', icon: '✉️' },
    { path: '/payslips', label: 'Payslips', icon: '💸' },
  ],
  parent: [
    { path: '/', label: 'My Child', icon: '👶' },
    { path: '/attendance', label: 'Attendance', icon: '📋' },
    { path: '/fees', label: 'Fees', icon: '💰' },
    { path: '/notices', label: 'Notices', icon: '📢' },
    { path: '/milestones', label: 'Milestones', icon: '🎯' },
  ],
};

const ROLE_LABELS: Record<UserRole, { emoji: string; label: string; color: string }> = {
  admin: { emoji: '🛡️', label: 'Admin', color: '#7C3AED' },
  staff: { emoji: '👩‍🏫', label: 'Staff', color: '#0B5FB3' },
  parent: { emoji: '👨‍👩‍👧', label: 'Parent', color: '#14B8A6' },
};

// ── App Layout ──
function AppLayout({ children, role, onClearRole }: { children: React.ReactNode; role: UserRole; onClearRole: () => void }) {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  const navItems = ROLE_NAV_MAP[role];
  const bottomNav = ROLE_BOTTOM_NAV[role];
  const roleInfo = ROLE_LABELS[role];

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser({ name: 'Admin', role: 'admin' })).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) setShowRoleMenu(false);
    }
    if (showMore || showRoleMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMore, showRoleMenu]);

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
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>{user?.name || 'Admin'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.75rem' }}>{roleInfo.emoji}</span>
            <span style={{ textTransform: 'capitalize', color: roleInfo.color, fontWeight: 600 }}>{roleInfo.label}</span>
          </div>
          <button
            onClick={onClearRole}
            style={{
              marginTop: 8, padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #E5E7EB',
              borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6B7280',
            }}
          >
            Switch Role
          </button>
          <button
            onClick={() => { onClearRole(); }}
            style={{
              marginTop: 4, padding: '4px 8px', fontSize: '0.7rem', border: '1px solid #FECACA',
              borderRadius: 6, background: '#FEF2F2', cursor: 'pointer', color: '#DC2626',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="https://i.imgur.com/0COuhlX.png" alt="Logo" style={{ height: 32, width: 'auto' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#073B73' }}>Lehakwe Manager</div>
            <div style={{ fontSize: '0.65rem', color: roleInfo.color, fontWeight: 500 }}>{roleInfo.emoji} {roleInfo.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={roleMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: roleInfo.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600,
                border: 'none', cursor: 'pointer',
              }}
            >
              {(user?.name || 'A')[0]}
            </button>
            {showRoleMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: 8, minWidth: 160, zIndex: 100,
              }}>
                <div style={{ padding: '6px 12px', fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 500 }}>
                  Current Role
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: '#F3F4F6', borderRadius: 8, margin: '0 4px',
                }}>
                  <span>{roleInfo.emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{roleInfo.label}</span>
                </div>
                <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />
                <button
                  onClick={() => { onClearRole(); setShowRoleMenu(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%',
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#DC2626',
                  }}
                >
                  🔄 Switch Role
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="main-content" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        {bottomNav.slice(0, 4).map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 12px', textDecoration: 'none',
              color: isActive ? '#0B5FB3' : '#6B7280', fontSize: '0.65rem', fontWeight: isActive ? 600 : 500,
            }}>
              <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        {/* More button */}
        <div ref={moreRef} style={{ position: 'relative' }}>
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
              {navItems.filter(n => !bottomNav.slice(0, 4).some(b => b.path === n.path)).map(n => (
                <Link key={n.path} to={n.path} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, textDecoration: 'none',
                  color: location.pathname === n.path ? '#0B5FB3' : '#374151',
                  fontWeight: location.pathname === n.path ? 600 : 400, fontSize: '0.85rem',
                  background: location.pathname === n.path ? '#EFF6FF' : 'transparent',
                }} onClick={() => setShowMore(false)}>
                  <span>{n.icon}</span> {n.label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 4, paddingTop: 4 }}>
                <button
                  onClick={() => { onClearRole(); setShowMore(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', width: '100%',
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#DC2626',
                  }}
                >
                  🔄 Switch Role
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Mobile More Drawer ── */}
      {showMore && <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 90 }} />}
      {showRoleMenu && <div onClick={() => setShowRoleMenu(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.1)', zIndex: 90 }} />}

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

// ── Root App ──
export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => !!getToken());
  const [role, setRole] = useState<UserRole | null>(() => {
    const stored = localStorage.getItem('lehakwe-role');
    return (stored as UserRole) || null;
  });

  const handleLogin = (user: any) => {
    setAuthenticated(true);
    // Auto-set role from JWT
    if (user.role === 'admin') {
      setRole('admin');
      localStorage.setItem('lehakwe-role', 'admin');
    } else if (user.role === 'staff') {
      setRole('staff');
      localStorage.setItem('lehakwe-role', 'staff');
    }
  };

  const handleSetRole = (r: UserRole) => {
    setRole(r);
    localStorage.setItem('lehakwe-role', r);
  };

  const handleClearRole = () => {
    setRole(null);
    localStorage.removeItem('lehakwe-role');
  };

  const handleLogout = () => {
    clearToken();
    setAuthenticated(false);
    setRole(null);
    localStorage.removeItem('lehakwe-role');
  };

  // Show login if not authenticated
  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (!role) {
    return <RoleSelector onSelect={handleSetRole} />;
  }

  return (
    <RoleContext.Provider value={{ role, setRole: handleSetRole, clearRole: handleClearRole }}>
      <BrowserRouter>
        <Routes>
          {/* Parent Portal — standalone, no sidebar */}
          <Route path="/parent/:childId" element={<ParentPortal />} />

          {/* Main routes — with sidebar */}
          <Route path="/*" element={
            <AppLayout role={role} onClearRole={handleLogout}>
              <Routes>
                <Route path="/" element={role === 'parent' ? <ParentDashboard /> : <Dashboard />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/daily-logs" element={<DailyLogs />} />
                <Route path="/children" element={<Children />} />
                <Route path="/milestones" element={<Milestones />} />
                <Route path="/fees" element={<Fees />} />
                <Route path="/notices" element={<Notices />} />
                <Route path="/ai" element={<AIAssistant />} />
                <Route path="/leave" element={<LeaveTracker />} />
                <Route path="/waitlist" element={<WaitlistPage />} />
                <Route path="/payslips" element={<Payslips />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/parents" element={<Parents />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </RoleContext.Provider>
  );
}
