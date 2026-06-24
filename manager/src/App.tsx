import { useState, useEffect, useCallback } from 'react';
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

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/inbox', label: 'Inbox', icon: '✉️' },
  { path: '/payslips', label: 'Payslips', icon: '💰' },
  { path: '/staff', label: 'Staff', icon: '👥' },
  { path: '/children', label: 'Children', icon: '👶' },
  { path: '/parents', label: 'Parents', icon: '👨‍👩‍👧' },
  { path: '/reports', label: 'Monthly Reports', icon: '📑' },
  { path: '/documents', label: 'Documents', icon: '📁' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser({ name: 'Admin', role: 'admin' })).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>;

  return (
    <div className="app-layout">
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
      <main className="main-content">
        {children}
      </main>
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
          <Route path="/payslips" element={<Payslips />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/children" element={<Children />} />
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
