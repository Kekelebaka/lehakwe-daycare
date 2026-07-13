import { useState, useEffect, useRef } from 'react';
import { signup, setStoredUser } from '../lib/api';
import { Brand, Field, Button } from '../components/ui';

const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

export default function Signup() {
  const [form, setForm] = useState({ centre_name: '', owner_name: '', owner_email: '', password: '', province: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const widgetRef = useRef<HTMLDivElement>(null);
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!SITE_KEY) return;
    const render = () => {
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
    if (document.getElementById('cf-turnstile-script')) { render(); return; }
    const s = document.createElement('script');
    s.id = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true; s.onload = render;
    document.head.appendChild(s);
  }, [SITE_KEY]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await signup({ ...form, turnstileToken });
      setStoredUser(data.user);
      localStorage.setItem('lehakwe-role', 'admin');
      window.location.assign('/setup');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--brand-purple) 0%, var(--brand-purple-dark) 100%)', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Brand size="lg" />
          <p style={{ color: 'var(--brand-purple)', fontSize: '0.8rem', fontWeight: 600, margin: '14px 0 0' }}>Stronger Centres. Brighter Futures. Together.</p>
          <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: '10px 0 0' }}>Create your centre — free to start, live in minutes.</p>
        </div>

        <form onSubmit={submit}>
          <Field label="Centre name" value={form.centre_name} onChange={set('centre_name')} placeholder="e.g. Little Stars Educare" required />
          <label className="ub-field">
            <span className="ub-field-label">Province</span>
            <select className="ub-field-input" value={form.province} onChange={set('province')}>
              <option value="">Select a province (optional)</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <Field label="Your name" value={form.owner_name} onChange={set('owner_name')} placeholder="Principal / owner name" required />
          <Field label="Email" type="email" value={form.owner_email} onChange={set('owner_email')} placeholder="you@example.com" required />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" required minLength={8} />

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#DC2626', fontSize: '0.85rem' }}>{error}</div>
          )}

          {SITE_KEY && <div ref={widgetRef} style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }} />}

          <Button type="submit" variant="primary" block disabled={loading}>{loading ? 'Creating your centre…' : 'Create centre'}</Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem', color: '#6B7280' }}>
          Already have a centre? <a href="/" style={{ color: 'var(--brand-purple)', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.75rem', color: '#9CA3AF' }}>Powered by ChiefOps</div>
      </div>
    </div>
  );
}
