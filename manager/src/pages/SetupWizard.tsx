import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Brand, Field, Button } from '../components/ui';

const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
const COLORS = ['#4B1F78', '#0F9D8A', '#F7931E', '#102A43', '#2563EB', '#DB2777', '#059669'];
const JOB_TITLES = ['Teacher', 'Assistant', 'Principal', 'Administrator', 'Cook', 'Cleaner'];
const STEPS = ['Profile', 'Branding', 'Fees', 'Staff', 'Children', 'Finish'];

type StaffRow = { full_name: string; email: string; job_title: string };

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  const [profile, setProfile] = useState({ centre_name: '', province: '', npo_number: '', daycare_address: '' });
  const [branding, setBranding] = useState({ primary_color: '#4B1F78', logo_url: '' });
  const [schedules, setSchedules] = useState<any[]>([]);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([{ full_name: '', email: '', job_title: 'Teacher' }]);
  const [childrenText, setChildrenText] = useState('');
  const [sampleMsg, setSampleMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [centre, settings, feeScheds] = await Promise.all([
          api.getCentre().catch(() => null),
          api.getSettings().catch(() => ({})),
          api.getFeeSchedules().catch(() => []),
        ]);
        setProfile({
          centre_name: (centre?.name) || settings?.daycare_name || '',
          province: settings?.province || centre?.province || '',
          npo_number: settings?.npo_number || '',
          daycare_address: settings?.daycare_address || '',
        });
        if (centre?.primary_color) setBranding((b) => ({ ...b, primary_color: centre.primary_color, logo_url: centre.logo_url || '' }));
        setSchedules(feeScheds || []);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function saveStep(i: number) {
    if (i === 0) {
      await api.updateCentre({ name: profile.centre_name });
      await api.updateSettings({ settings: { daycare_name: profile.centre_name, province: profile.province, npo_number: profile.npo_number, daycare_address: profile.daycare_address } });
    } else if (i === 1) {
      await api.updateCentre({ primary_color: branding.primary_color, logo_url: branding.logo_url });
    } else if (i === 2) {
      for (const s of schedules) await api.updateFeeSchedule(s.schedule_id, { monthly_fee: Number(s.monthly_fee) || 0 });
    } else if (i === 3) {
      for (const s of staffRows) if (s.full_name.trim() && s.job_title) await api.createStaff({ full_name: s.full_name.trim(), email: s.email.trim() || undefined, job_title: s.job_title });
    } else if (i === 4) {
      const lines = childrenText.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const [full_name, dob, age_group] = line.split(',').map((p) => p.trim());
        if (full_name) await api.createChild({ full_name, date_of_birth: dob || undefined, age_group: age_group || undefined });
      }
    }
  }

  async function next() {
    setSaving(true); setErr('');
    try { await saveStep(step); setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
    catch (e: any) { setErr(e.message || 'Could not save this step'); }
    finally { setSaving(false); }
  }
  const skip = () => { setErr(''); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => { setErr(''); setStep((s) => Math.max(s - 1, 0)); };

  async function loadSample() {
    setSaving(true); setSampleMsg('');
    try {
      const p = await api.createParent({ full_name: 'Sample Parent', phone: '0000000000', email: 'sample.parent@example.com' });
      await api.createChild({ full_name: 'Amahle Sample', age_group: 'Toddlers (18m–3y)', parent_id: p.parent_id, status: 'active' });
      await api.createChild({ full_name: 'Sipho Sample', age_group: 'Preschool (3–6y)', parent_id: p.parent_id, status: 'active' });
      setSampleMsg('Sample family added — you can explore, then delete it later.');
    } catch (e: any) { setSampleMsg(e.message || 'Could not add sample data'); }
    finally { setSaving(false); }
  }

  async function finish() {
    setSaving(true); setErr('');
    try { await api.completeSetup(); window.location.assign('/'); }
    catch (e: any) { setErr(e.message || 'Could not finish setup'); setSaving(false); }
  }

  if (!ready) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#6B7280' }}>Loading your centre…</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #F5F3FF 0%, #ECFEFF 100%)', padding: '28px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <Brand size="lg" />
          <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: '8px 0 0' }}>Let’s set up your centre — this takes about 3 minutes.</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: i <= step ? 1 : 0.45 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', background: i < step ? 'var(--brand-teal)' : i === step ? 'var(--brand-purple)' : '#CBD5E1' }}>{i < step ? '✓' : i + 1}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: i === step ? 700 : 500, color: i === step ? 'var(--brand-purple)' : '#64748B' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '26px 24px', boxShadow: '0 10px 40px rgba(16,42,67,0.08)' }}>
          {step === 0 && (
            <>
              <h2 style={h2}>Your centre profile</h2>
              <p style={sub}>This appears on reports, letters and your funding applications.</p>
              <Field label="Centre name" value={profile.centre_name} onChange={(e) => setProfile({ ...profile, centre_name: e.target.value })} placeholder="Little Stars Educare" />
              <label className="ub-field"><span className="ub-field-label">Province</span>
                <select className="ub-field-input" value={profile.province} onChange={(e) => setProfile({ ...profile, province: e.target.value })}>
                  <option value="">Select…</option>{PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <Field label="NPO number (if registered)" value={profile.npo_number} onChange={(e) => setProfile({ ...profile, npo_number: e.target.value })} placeholder="e.g. 123-456 NPO" />
              <Field label="Address" value={profile.daycare_address} onChange={(e) => setProfile({ ...profile, daycare_address: e.target.value })} placeholder="Street, suburb, town" />
            </>
          )}

          {step === 1 && (
            <>
              <h2 style={h2}>Branding</h2>
              <p style={sub}>Pick your centre’s accent colour and (optionally) a logo.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0 16px' }}>
                {COLORS.map((col) => (
                  <button key={col} onClick={() => setBranding({ ...branding, primary_color: col })} title={col}
                    style={{ width: 40, height: 40, borderRadius: 10, background: col, cursor: 'pointer', border: branding.primary_color === col ? '3px solid #102A43' : '2px solid #E5E7EB' }} />
                ))}
                <input type="color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} style={{ width: 40, height: 40, border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
              <Field label="Logo URL (optional)" value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} placeholder="https://…/logo.png" />
              {branding.logo_url && <img src={branding.logo_url} alt="logo preview" style={{ maxHeight: 60, marginTop: 10, borderRadius: 8 }} onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={h2}>Monthly fees</h2>
              <p style={sub}>Set a monthly fee (in Rand) for each age group. You can refine these later in Fees & Finance.</p>
              {schedules.length === 0 && <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>No fee groups yet — you can add them in Fees & Finance.</p>}
              {schedules.map((s, i) => (
                <div key={s.schedule_id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>{s.age_group}</span>
                  <span style={{ color: '#6B7280' }}>R</span>
                  <input className="ub-field-input" style={{ width: 120 }} type="number" min="0" value={s.monthly_fee ?? 0}
                    onChange={(e) => { const v = e.target.value; setSchedules((arr) => arr.map((x, j) => j === i ? { ...x, monthly_fee: v } : x)); }} />
                </div>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={h2}>Invite your team</h2>
              <p style={sub}>Add teachers and staff. You can add more (and set logins) later from the Staff page.</p>
              {staffRows.map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px', gap: 8, marginBottom: 8 }}>
                  <input className="ub-field-input" placeholder="Full name" value={row.full_name} onChange={(e) => setStaffRows((a) => a.map((r, j) => j === i ? { ...r, full_name: e.target.value } : r))} />
                  <input className="ub-field-input" placeholder="Email (optional)" value={row.email} onChange={(e) => setStaffRows((a) => a.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} />
                  <select className="ub-field-input" value={row.job_title} onChange={(e) => setStaffRows((a) => a.map((r, j) => j === i ? { ...r, job_title: e.target.value } : r))}>
                    {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
              <Button variant="ghost" onClick={() => setStaffRows((a) => [...a, { full_name: '', email: '', job_title: 'Teacher' }])}>+ Add another</Button>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={h2}>Add children</h2>
              <p style={sub}>Paste one child per line as <code>Full name, YYYY-MM-DD, Age group</code>. Date and age group are optional. You can import more later.</p>
              <textarea className="ub-field-input" style={{ minHeight: 140, fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={childrenText} onChange={(e) => setChildrenText(e.target.value)}
                placeholder={'Amara Dlamini, 2022-04-18, Toddlers (18m–3y)\nSipho Nkosi, 2021-09-03, Preschool (3–6y)'} />
            </>
          )}

          {step === 5 && (
            <>
              <h2 style={h2}>You’re ready 🎉</h2>
              <p style={sub}>Your centre is set up. You can add anything else anytime from the menu.</p>
              <div style={{ background: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--brand-purple)', marginBottom: 6 }}>{profile.centre_name || 'Your centre'}</div>
                <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>Compliance checklist, fee groups and your account are ready. Explore the dashboard, or add a sample family to see how it looks.</div>
              </div>
              <Button variant="secondary" onClick={loadSample} disabled={saving}>Add a sample family</Button>
              {sampleMsg && <p style={{ fontSize: '0.82rem', color: '#0F9D8A', marginTop: 8 }}>{sampleMsg}</p>}
            </>
          )}

          {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', margin: '16px 0 0', color: '#DC2626', fontSize: '0.85rem' }}>{err}</div>}

          {/* Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, gap: 10 }}>
            <div>{step > 0 && <Button variant="ghost" onClick={back} disabled={saving}>← Back</Button>}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && step < 5 && <Button variant="ghost" onClick={skip} disabled={saving}>Skip</Button>}
              {step < 5
                ? <Button variant="primary" onClick={next} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</Button>
                : <Button variant="primary" onClick={finish} disabled={saving}>{saving ? 'Finishing…' : 'Go to dashboard'}</Button>}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.72rem', color: '#9CA3AF' }}>Ubuntu Daycare OS · Powered by ChiefOps</div>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 700, color: '#102A43', margin: '0 0 4px' };
const sub: React.CSSProperties = { fontSize: '0.85rem', color: '#6B7280', margin: '0 0 16px' };
