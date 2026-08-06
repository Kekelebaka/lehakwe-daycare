// Phase 5 — the landing page for the one-time "get started" link emailed after
// a successful Paystack payment.
//
// Journey: click link -> token redeemed (session cookie set) -> choose a
// password -> straight into the setup wizard. This is the first thing a paying
// customer sees, so it must be calm, reassuring and impossible to get stuck on.

import { useState, useEffect } from 'react';
import { redeemSetupToken, setPassword, setStoredUser } from '../lib/api';
import { Brand, Field, Button } from '../components/ui';

type Phase = 'redeeming' | 'choose_password' | 'saving' | 'error';

export default function Welcome() {
  const [phase, setPhase] = useState<Phase>('redeeming');
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const token = new URLSearchParams(window.location.search).get('token') || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError('This link is incomplete. Please open the link from your email exactly as it was sent.');
        setPhase('error');
        return;
      }
      try {
        const data = await redeemSetupToken(token);
        if (cancelled) return;
        setStoredUser(data.user);
        localStorage.setItem('lehakwe-role', 'admin');
        setUser(data.user);
        setPhase('choose_password');
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || 'This link is no longer valid.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) return setError('Please choose at least 8 characters.');
    if (pw !== pw2) return setError('The two passwords do not match.');
    setPhase('saving');
    try {
      await setPassword(pw);
      window.location.assign('/setup');
    } catch (err: any) {
      setError(err.message || 'Could not save your password.');
      setPhase('choose_password');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--brand-purple) 0%, var(--brand-purple-dark) 100%)', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Brand size="lg" />
          <p style={{ color: 'var(--brand-purple)', fontSize: '0.8rem', fontWeight: 600, margin: '14px 0 0' }}>
            Stronger Centres. Brighter Futures. Together.
          </p>
        </div>

        {phase === 'redeeming' && (
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '0.95rem', padding: '20px 0' }}>
            Signing you in…
          </p>
        )}

        {phase === 'error' && (
          <>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 14, fontSize: '0.9rem' }}>
              {error}
            </div>
            <p style={{ color: '#6B7280', fontSize: '0.875rem', marginTop: 16, textAlign: 'center' }}>
              Already set up? <a href="/" style={{ color: 'var(--brand-purple)', fontWeight: 600 }}>Sign in instead</a>
            </p>
          </>
        )}

        {(phase === 'choose_password' || phase === 'saving') && (
          <>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', borderRadius: 12, padding: 14, fontSize: '0.9rem', marginBottom: 20 }}>
              <strong>Payment received — your centre is ready.</strong>
              <div style={{ marginTop: 4 }}>Choose a password and we'll walk you through setup.</div>
            </div>

            {user?.email && (
              <p style={{ color: '#6B7280', fontSize: '0.85rem', margin: '0 0 14px' }}>
                Signing in as <strong style={{ color: '#111827' }}>{user.email}</strong>
              </p>
            )}

            <form onSubmit={submit}>
              <Field
                label="Create a password"
                type="password"
                value={pw}
                onChange={(e: any) => setPw(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <Field
                label="Confirm password"
                type="password"
                value={pw2}
                onChange={(e: any) => setPw2(e.target.value)}
                placeholder="Type it once more"
                autoComplete="new-password"
                required
              />

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 12, fontSize: '0.85rem', margin: '4px 0 14px' }}>
                  {error}
                </div>
              )}

              <Button type="submit" block disabled={phase === 'saving'}>
                {phase === 'saving' ? 'Saving…' : 'Continue to setup →'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
