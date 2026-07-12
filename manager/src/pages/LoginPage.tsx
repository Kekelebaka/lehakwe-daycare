import { useState, useEffect, useRef } from 'react';
import { login, setStoredUser } from '../lib/api';
import { Brand, Field, Button } from '../components/ui';

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Render the Cloudflare Turnstile widget when a site key is configured.
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--brand-purple) 0%, var(--brand-purple-dark) 100%)', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Brand size="lg" />
          <p style={{ color: 'var(--brand-purple)', fontSize: '0.8rem', fontWeight: 600, margin: '14px 0 0' }}>Stronger Centres. Brighter Futures. Together.</p>
          <p style={{ color: '#6B7280', fontSize: '0.85rem', margin: '10px 0 0' }}>Sign in to your centre</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {SITE_KEY && <div ref={widgetRef} style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }} />}

          <Button type="submit" variant="primary" block disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.75rem', color: '#9CA3AF' }}>Powered by ChiefOps</div>
      </div>
    </div>
  );
}
