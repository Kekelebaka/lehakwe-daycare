import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { api, getStoredUser, logout } from './lib/api';
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
import ParentLogin from './pages/ParentLogin';
import ParentApp from './pages/ParentApp';
import DailyLogs from './pages/DailyLogs';
import LeaveTracker from './pages/LeaveTracker';
import WaitlistPage from './pages/WaitlistPage';
import ParentDashboard from './pages/ParentDashboard';
import RoleSelector from './components/RoleSelector';
import { Brand } from './components/ui';

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
    { path: '/attendance', label: 'Attend', icon: '📋' },
  ],
  staff: [
    { path: '/', label: 'Home', icon: '📊' },
    { path: '/attendance', label: 'Attendance', icon: '📋' },
    { path: '/daily-logs', label: 'Logs', icon: '📝' },
    { path: '/inbox', label: 'Inbox', icon: '✉️' },
  ],
  parent: [
    { path: '/', label: 'My Child', icon: '👶' },
    { path: '/attendance', label: 'Attendance', icon: '📋' },
    { path: '/fees', label: 'Fees', icon: '💰' },
    { path: '/notices', label: 'Notices', icon: '📢' },
  ],
};

const ROLE_LABELS: Record<UserRole, { emoji: string; label: string; color: string }> = {
  admin: { emoji: '🛡️', label: 'Admin', color: '#4B1F78' },
  staff: { emoji: '👩‍🏫', label: 'Staff', color: '#0F9D8A' },
  parent: { emoji: '👨‍👩‍👧', label: 'Parent', color: '#F7931E' },
};

// ── App Layout ──
function AppLayout({ children, role, onClearRole }: { children: React.ReactNode; role: UserRole; onClearRole: () => void }) {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const navItems = ROLE_NAV_MAP[role];
  const bottomNav = ROLE_BOTTOM_NAV[role];
  const roleInfo = ROLE_LABELS[role];

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser({ name: 'Admin', role: 'admin' })).finally(() => setLoading(false));
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

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
          <div>
            <Brand size="md" />
            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 4 }}>Powered by ChiefOps</div>
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
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            width: 40, height: 40, borderRadius: 10, border: 'none',
            background: '#F3F4F6', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer', padding: 8, flexShrink: 0,
          }}
        >
          <span style={{ width: 18, height: 2, background: '#073B73', borderRadius: 1 }} />
          <span style={{ width: 18, height: 2, background: '#073B73', borderRadius: 1 }} />
          <span style={{ width: 18, height: 2, background: '#073B73', borderRadius: 1 }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <Brand size="sm" />
            <div style={{ fontSize: '0.65rem', color: roleInfo.color, fontWeight: 500, marginTop: 2 }}>{roleInfo.emoji} {roleInfo.label}</div>
          </div>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: roleInfo.color,
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 600, flexShrink: 0,
        }}>
          {(user?.name || 'A')[0]}
        </div>
      </div>

      {/* ── Mobile Slide-Out Drawer ── */}
      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 9998,
      }} />}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 300, maxWidth: '85vw', background: 'white',
        zIndex: 9999,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
        boxShadow: drawerOpen ? '4px 0 20px rgba(0,0,0,0.2)' : 'none',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        willChange: 'transform',
      }}>
        {/* Drawer Header */}
        <div style={{ background: 'linear-gradient(135deg, var(--brand-purple), var(--brand-purple-dark))', padding: '20px 16px 16px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <Brand size="md" onDark />
            <button onClick={() => setDrawerOpen(false)} style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.2)', color: 'white',
              fontSize: '1rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>✕</button>
          </div>
          <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: 1 }}>Powered by ChiefOps</div>
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 700,
            }}>{(user?.name || 'A')[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Admin'}</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{roleInfo.emoji} {roleInfo.label}</div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '6px 10px' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 8px 4px' }}>Navigation</div>
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, textDecoration: 'none', marginBottom: 1,
                background: active ? '#EFF6FF' : 'transparent',
                color: active ? '#0B5FB3' : '#374151',
                fontWeight: active ? 600 : 400, fontSize: '0.85rem',
                borderLeft: active ? '3px solid #0B5FB3' : '3px solid transparent',
              }}>
                <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={() => { onClearRole(); setDrawerOpen(false); }} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', width: '100%', borderRadius: 10,
            border: '1px solid #E5E7EB', background: '#F9FAFB',
            cursor: 'pointer', fontSize: '0.8rem', color: '#6B7280', marginBottom: 5,
          }}><span>🔄</span> Switch Role</button>
          <button onClick={() => { onClearRole(); setDrawerOpen(false); }} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', width: '100%', borderRadius: 10,
            border: '1px solid #FECACA', background: '#FEF2F2',
            cursor: 'pointer', fontSize: '0.8rem', color: '#DC2626',
          }}><span>🚪</span> Sign Out</button>
          <div style={{ textAlign: 'center', fontSize: '0.58rem', color: '#D1D5DB', marginTop: 8 }}>Ubuntu Daycare OS · Powered by ChiefOps</div>
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
              padding: '6px 8px', textDecoration: 'none', flex: 1,
              color: isActive ? '#0B5FB3' : '#6B7280', fontSize: '0.6rem',
              fontWeight: isActive ? 600 : 500,
              position: 'relative',
            }}>
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 24, height: 2, borderRadius: 1, background: '#0B5FB3',
                }} />
              )}
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
              <span style={{ lineHeight: 1 }}>{item.label}</span>
            </Link>
          );
        })}
        {/* More button → opens drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer',
            color: '#6B7280', fontSize: '0.6rem', fontWeight: 500, flex: 1,
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>☰</span>
          <span style={{ lineHeight: 1 }}>More</span>
        </button>
      </nav>

      <style>{`
        .mobile-header { display: none; }
        .bottom-nav { display: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 767px) {
          .app-layout { flex-direction: column; }
          .sidebar { display: none !important; }
          .mobile-header {
            display: flex !important;
            align-items: center; gap: 12px;
            padding: 10px 14px;
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

// ── Staff app (auth-gated) ──
function StaffApp() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => !!getStoredUser());
  const [role, setRole] = useState<UserRole | null>(() => {
    const stored = localStorage.getItem('lehakwe-role');
    return (stored as UserRole) || null;
  });

  const handleLogin = (user: any) => {
    setAuthenticated(true);
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
    logout();
    setAuthenticated(false);
    setRole(null);
    localStorage.removeItem('lehakwe-role');
  };

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
          <Route path="/parent/:childId" element={<ParentPortal />} />
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

// ── Root: parents get their own app; everything else is the staff app ──
export default function App() {
  const path = window.location.pathname;
  if (path.startsWith('/parent/') || path === '/parent-login' || path.startsWith('/my')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/parent/:childId" element={<ParentPortal />} />
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/my" element={<ParentApp />} />
          <Route path="*" element={<ParentLogin />} />
        </Routes>
      </BrowserRouter>
    );
  }
  return <StaffApp />;
}
