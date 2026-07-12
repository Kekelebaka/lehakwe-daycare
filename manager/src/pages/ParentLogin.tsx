import { useState, useEffect } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { parentApi } from '../lib/api';
import { Brand } from '../components/ui';

export default function ParentLogin() {
  const [step, setStep] = useState<'id' | 'code'>('id');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [channel, setChannel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('e');
    if (e) setIdentifier(e);
  }, []);

  const request = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      const d = await parentApi.requestOtp(identifier.trim());
      setChannel(d.channel);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Could not send a code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      await parentApi.verifyOtp(identifier.trim(), code.trim());
      window.location.href = '/my';
    } catch (err: any) {
      setError(err.message || 'Incorrect code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4B1F78 0%, #37155C 100%)', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '36px 30px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Brand size="lg" />
          <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: '14px 0 0' }}>Parent sign-in — see your child's day</p>
        </div>

        {step === 'id' ? (
          <form onSubmit={request}>
            <label style={labelS}>Phone number or email</label>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="e.g. 072 123 4567" required style={inputS} />
            {error && <div style={errS}>{error}</div>}
            <button type="submit" disabled={loading} style={btnS(loading)}>{loading ? 'Sending…' : 'Send me a code'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: 12 }}>
              We sent a 6-digit code {channel === 'email' ? 'to your email' : 'to your phone'}. Enter it below.
            </p>
            <label style={labelS}>Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="——————" required style={{ ...inputS, letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.2rem' }} />
            {error && <div style={errS}>{error}</div>}
            <button type="submit" disabled={loading} style={btnS(loading)}>{loading ? 'Checking…' : 'Sign in'}</button>
            <button type="button" onClick={() => { setStep('id'); setCode(''); setError(''); }} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: '#4B1F78', fontSize: '0.8rem', cursor: 'pointer' }}>← Use a different number / email</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: '#9CA3AF' }}>Powered by ChiefOps</div>
      </div>
    </div>
  );
}

const labelS: CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 };
const inputS: CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #D1D5DB', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', marginBottom: 12 };
const errS: CSSProperties = { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#DC2626', fontSize: '0.85rem' };
const btnS = (loading: boolean): CSSProperties => ({ width: '100%', padding: '13px', borderRadius: 10, background: loading ? '#B79AD6' : '#4B1F78', color: 'white', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' });
