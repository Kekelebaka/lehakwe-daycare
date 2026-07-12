import { useState, useEffect, useRef } from 'react';
import { login, setStoredUser } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Phase 0b: render the Cloudflare Turnstile widget when a site key is configured.
  useEffect(() => {
    if (!SITE_KEY) return;
    const renderWidget = () => {
      const t = (window as any).turnstile;
      if (t && widgetRef.current && !widgetRef.current.dataset.rendered) {
        t.render(widgetRef.current, {
          sitekey: SITE_KEY,
          callback: (tok: string) => setTurnstileToken(tok),
          'error-callback': () => setTurnstileToken(''),
          'expired-callback': () => setTurnstileToken(''),
        });
        widgetRef.current.dataset.rendered = '1';
      }
    };
    if (document.getElementById('cf-turnstile-script')) { renderWidget(); return; }
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true; s.onload = renderWidget;
    document.head.appendChild(s);
  }, [SITE_KEY]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(email, password, turnstileToken);
      setStoredUser(user);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0B5FB3 0%, #073B73 100%)',
      padding: 20,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 32px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="https://i.imgur.com/0COuhlX.png" alt="Lehakwe Daycare" style={{ height: 60, marginBottom: 16 }} />
          <h1 style={{ fontSize: '1.4rem', color: '#073B73', margin: 0 }}>Lehakwe Manager</h1>
          <p style={{ color: '#6B7280', fontSize: '0.85rem', margin: '4px 0 0' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '1.5px solid #D1D5DB', fontSize: '0.95rem',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#0B5FB3'}
              onBlur={e => e.target.style.borderColor = '#D1D5DB'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '1.5px solid #D1D5DB', fontSize: '0.95rem',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#0B5FB3'}
              onBlur={e => e.target.style.borderColor = '#D1D5DB'}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
              padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          {SITE_KEY && <div ref={widgetRef} style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }} />}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: loading ? '#93C5FD' : '#0B5FB3',
              color: 'white', fontWeight: 700, fontSize: '1rem',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.75rem', color: '#9CA3AF' }}>
          Powered by ChiefCare · NPO 229-695
        </div>
      </div>
    </div>
  );
}
