// Phase 6 — the Ubuntu Town coordinator console.
//
// A coordinator looks after a portfolio of community creches. This screen is
// their home: who they support, who needs help, and the two actions that
// matter — onboard a new creche, or step into one and set it up for them.
//
// Sign-in is Ubuntu Town (Supabase). We never handle their password: the
// Supabase client obtains an access token, we hand it to our API, the API
// verifies it against the project's JWKS and issues a coordinator session.

import { useState, useEffect, useCallback } from 'react';
import { Brand, Field, Button } from '../components/ui';
import {
  coordinatorSession, coordinatorMe, coordinatorCentres,
  coordinatorCreateCentre, coordinatorActAs, coordinatorLogout,
  supabaseSignIn, setStoredUser,
} from '../lib/api';

type Centre = {
  centre_id: string; name: string; slug: string; province?: string; email?: string;
  status: string; plan: string; children: number; staff: number;
  setup_complete: boolean; compliance_percent: number;
  subscription: { status: string; paid_until: string | null; access: string; allowed: boolean };
};
type Summary = { total: number; active: number; needs_attention: number; children: number };

const PROVINCES = ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'];

export default function CoordinatorConsole() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'ready'>('checking');
  const [me, setMe] = useState<any>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // onboarding form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ centre_name: '', owner_name: '', owner_email: '', phone: '', province: '' });

  const load = useCallback(async () => {
    const data = await coordinatorCentres();
    setCentres(data.centres || []);
    setSummary(data.summary || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profile = await coordinatorMe();
        setMe(profile);
        await load();
        setPhase('ready');
      } catch {
        setPhase('login');
      }
    })();
  }, [load]);

  // Returning from a Paystack payment for a sponsored place.
  useEffect(() => {
    if (phase !== 'ready') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (!ref) return;
    let tries = 0;
    const tick = async () => {
      tries++;
      try { await load(); } catch { /* keep polling */ }
      if (tries < 8) setTimeout(tick, 3000);
      else window.history.replaceState({}, '', '/coordinator');
    };
    tick();
  }, [phase, load]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const token = await supabaseSignIn(email, password); // Ubuntu Town account
      await coordinatorSession(token);
      const profile = await coordinatorMe();
      setMe(profile);
      await load();
      setPhase('ready');
    } catch (err: any) {
      setError(err.message || 'Could not sign you in.');
    } finally { setBusy(false); }
  };

  const addCentre = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await coordinatorCreateCentre(form);
      window.location.assign(res.authorization_url); // R250 Community fee
    } catch (err: any) {
      setError(err.message || 'Could not start the onboarding.');
      setBusy(false);
    }
  };

  const actAs = async (centre: Centre) => {
    setError(''); setBusy(true);
    try {
      const res = await coordinatorActAs(centre.centre_id);
      setStoredUser(res.user);
      localStorage.setItem('lehakwe-role', 'admin');
      window.location.assign(res.redirect || '/setup');
    } catch (err: any) {
      setError(err.message || 'Could not open that centre.');
      setBusy(false);
    }
  };

  // ── Sign in ─────────────────────────────────────────────────────
  if (phase === 'checking') {
    return <Centered><p style={{ color: '#6B7280' }}>Loading your portfolio…</p></Centered>;
  }

  if (phase === 'login') {
    return (
      <Centered>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <Brand size="lg" />
          <p style={{ color: 'var(--brand-purple)', fontSize: '.8rem', fontWeight: 600, margin: '14px 0 0' }}>
            Ubuntu Town · Coordinator Console
          </p>
          <p style={{ color: '#6B7280', fontSize: '.9rem', margin: '10px 0 0' }}>
            Sign in with your Ubuntu Town account.
          </p>
        </div>
        <form onSubmit={signIn}>
          <Field label="Email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@ubuntutown.co.za" required />
          <Field label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Your Ubuntu Town password" required />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" block disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p style={{ color: '#9CA3AF', fontSize: '.8rem', marginTop: 16, textAlign: 'center' }}>
          Coordinator access is granted by your network administrator.
        </p>
      </Centered>
    );
  }

  // ── Console ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F8FBFF' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Brand />
          <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--brand-purple)', background: '#F3E8FF', padding: '4px 10px', borderRadius: 999 }}>
            Coordinator
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '.85rem', color: '#6B7280' }}>{me?.name || me?.email}</span>
          <button onClick={async () => { await coordinatorLogout(); window.location.reload(); }}
            style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '.85rem' }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', color: '#111827', margin: 0 }}>Your centres</h1>
            <p style={{ color: '#6B7280', margin: '6px 0 0', fontSize: '.95rem' }}>
              Centres you support on the sponsored Community plan.
            </p>
          </div>
          <Button onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Onboard a creche'}</Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginTop: 20 }}>
            <Stat label="Centres" value={summary.total} />
            <Stat label="Active" value={summary.active} tone="#059669" />
            <Stat label="Need attention" value={summary.needs_attention} tone={summary.needs_attention ? '#B45309' : undefined} />
            <Stat label="Children reached" value={summary.children} tone="var(--brand-purple)" />
          </div>
        )}

        {showAdd && (
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 22, marginTop: 20 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>Onboard a community creche</h2>
            <p style={{ color: '#6B7280', fontSize: '.88rem', margin: '0 0 16px' }}>
              You'll pay the R250 sponsored place. The centre is created the moment payment clears, and the
              principal receives their own sign-in link.
            </p>
            <form onSubmit={addCentre}>
              <Field label="Centre name" value={form.centre_name} onChange={(e: any) => setForm({ ...form, centre_name: e.target.value })} placeholder="e.g. Bloemside Community Creche" required />
              <Field label="Principal's name" value={form.owner_name} onChange={(e: any) => setForm({ ...form, owner_name: e.target.value })} placeholder="Full name" required />
              <Field label="Principal's email" type="email" value={form.owner_email} onChange={(e: any) => setForm({ ...form, owner_email: e.target.value })} placeholder="principal@creche.co.za" required />
              <Field label="Phone / WhatsApp" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="072 123 4567" />
              <label className="ub-field">
                <span className="ub-field-label">Province</span>
                <select className="ub-field-input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })}>
                  <option value="">Select a province</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <Button type="submit" block disabled={busy}>{busy ? 'Opening secure checkout…' : 'Continue to payment — R250 →'}</Button>
            </form>
          </div>
        )}

        <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
          {centres.length === 0 && !showAdd && (
            <div style={{ background: 'white', border: '1px dashed #D1D5DB', borderRadius: 14, padding: 40, textAlign: 'center', color: '#6B7280' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>No centres yet</p>
              <p style={{ margin: '8px 0 0', fontSize: '.9rem' }}>Onboard your first community creche to get started.</p>
            </div>
          )}

          {centres.map((c) => (
            <div key={c.centre_id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.02rem', color: '#111827' }}>{c.name}</strong>
                  <Pill ok={c.subscription.allowed}>
                    {c.subscription.allowed ? (c.subscription.access === 'grace' ? 'Payment due' : 'Active') : 'Lapsed'}
                  </Pill>
                  {!c.setup_complete && <Pill ok={false} amber>Setup incomplete</Pill>}
                </div>
                <div style={{ color: '#6B7280', fontSize: '.85rem', marginTop: 6 }}>
                  {c.province || '—'} · {c.children} children · {c.staff} staff · compliance {c.compliance_percent}%
                  {c.subscription.paid_until && <> · paid to {new Date(c.subscription.paid_until).toLocaleDateString('en-ZA')}</>}
                </div>
              </div>
              <Button onClick={() => actAs(c)} disabled={busy}>
                {c.setup_complete ? 'Open centre' : 'Set up for them →'}
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ── little presentational helpers ─────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--brand-purple) 0%, var(--brand-purple-dark) 100%)', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '38px 32px', width: '100%', maxWidth: 430, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        {children}
      </div>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 12, fontSize: '.87rem', margin: '14px 0' }}>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tone || '#111827' }}>{value}</div>
      <div style={{ fontSize: '.8rem', color: '#6B7280', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Pill({ children, ok, amber }: { children: React.ReactNode; ok: boolean; amber?: boolean }) {
  const bg = amber ? '#FEF3C7' : ok ? '#ECFDF5' : '#FEF2F2';
  const fg = amber ? '#92400E' : ok ? '#065F46' : '#B91C1C';
  return (
    <span style={{ background: bg, color: fg, fontSize: '.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
      {children}
    </span>
  );
}
