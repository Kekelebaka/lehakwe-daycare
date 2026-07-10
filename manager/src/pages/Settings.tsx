import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Settings() {
  const [settings, setSettings] = useState<any>({
    daycare_name: '', daycare_address: '', npo_number: '',
    official_email: '', website: '', phone: '',
    uif_enabled: true, paye_enabled: false,
    province: '', municipality: '', emis_number: '', manager_name: '', town: '', ward: '', fax_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings()
      .then(data => {
        if (data) setSettings((prev: Record<string, any>) => ({ ...prev, ...data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: string, value: any) =>
    setSettings((s: Record<string, any>) => ({ ...s, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateSettings({
        daycare_name: settings.daycare_name,
        daycare_address: settings.daycare_address,
        npo_number: settings.npo_number,
        official_email: settings.official_email,
        website: settings.website,
        phone: settings.phone,
        uif_enabled: settings.uif_enabled ? 1 : 0,
        paye_enabled: settings.paye_enabled ? 1 : 0,
        province: settings.province || '',
        municipality: settings.municipality || '',
        emis_number: settings.emis_number || '',
        manager_name: settings.manager_name || '',
        town: settings.town || '',
        ward: settings.ward || '',
        fax_number: settings.fax_number || '',
      });
      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #E5E7EB', fontSize: '0.9rem',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: 600,
    color: '#374151', marginBottom: 5,
  };

  const toggleTrack = (enabled: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
    background: enabled ? '#1A3D7C' : '#D1D5DB',
    position: 'relative', transition: 'background 0.2s',
    border: 'none', padding: 0,
  });
  const toggleThumb = (enabled: boolean): React.CSSProperties => ({
    width: 20, height: 20, borderRadius: '50%', background: 'white',
    position: 'absolute', top: 2, left: enabled ? 22 : 2,
    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2>Settings</h2>
          <p>Configure your daycare details and preferences.</p>
        </div>
        <div className="card">
          <p style={{ padding: 20, color: '#6B7280' }}>Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure your daycare details and preferences.</p>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 20 }}>Daycare Information</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Daycare Name</label>
            <input style={inputStyle} value={settings.daycare_name}
              onChange={e => set('daycare_name', e.target.value)}
              placeholder="e.g. Lehakwe Daycare" />
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={settings.daycare_address}
              onChange={e => set('daycare_address', e.target.value)}
              placeholder="e.g. 12625 Phase 6, Bloemfontein" />
          </div>

          <div>
            <label style={labelStyle}>NPO Number</label>
            <input style={inputStyle} value={settings.npo_number}
              onChange={e => set('npo_number', e.target.value)}
              placeholder="e.g. 229-695" />
          </div>

          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={settings.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 061 549 1701" />
          </div>

          <div>
            <label style={labelStyle}>Official Email</label>
            <input style={inputStyle} type="email" value={settings.official_email}
              onChange={e => set('official_email', e.target.value)}
              placeholder="e.g. info@lehakwedaycare.co.za" />
          </div>

          <div>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} value={settings.website}
              onChange={e => set('website', e.target.value)}
              placeholder="e.g. https://lehakwedaycare.co.za" />
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32, marginBottom: 16 }}>📋 DSD Reporting Details</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Province</label>
            <select style={inputStyle} value={settings.province || ''}
              onChange={e => set('province', e.target.value)}>
              <option value="">— Select —</option>
              {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Municipality / District</label>
            <input style={inputStyle} value={settings.municipality || ''}
              onChange={e => set('municipality', e.target.value)}
              placeholder="e.g. Mangaung" />
          </div>

          <div>
            <label style={labelStyle}>Town / City</label>
            <input style={inputStyle} value={settings.town || ''}
              onChange={e => set('town', e.target.value)}
              placeholder="e.g. Bloemfontein" />
          </div>

          <div>
            <label style={labelStyle}>Ward</label>
            <input style={inputStyle} value={settings.ward || ''}
              onChange={e => set('ward', e.target.value)}
              placeholder="e.g. Ward 4" />
          </div>

          <div>
            <label style={labelStyle}>EMIS Number</label>
            <input style={inputStyle} value={settings.emis_number || ''}
              onChange={e => set('emis_number', e.target.value)}
              placeholder="Education Management Info System number" />
          </div>

          <div>
            <label style={labelStyle}>Manager / Principal Name</label>
            <input style={inputStyle} value={settings.manager_name || ''}
              onChange={e => set('manager_name', e.target.value)}
              placeholder="Full name for report signatures" />
          </div>

          <div>
            <label style={labelStyle}>Fax Number</label>
            <input style={inputStyle} value={settings.fax_number || ''}
              onChange={e => set('fax_number', e.target.value)}
              placeholder="N/A if none" />
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 32, marginBottom: 16 }}>Payroll Defaults</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>UIF Contributions</div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Enable 1% UIF deduction for staff</div>
            </div>
            <button
              style={toggleTrack(settings.uif_enabled)}
              onClick={() => set('uif_enabled', !settings.uif_enabled)}
              aria-label="Toggle UIF"
            >
              <div style={toggleThumb(settings.uif_enabled)} />
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>PAYE Calculations</div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Enable PAYE tax calculations</div>
            </div>
            <button
              style={toggleTrack(settings.paye_enabled)}
              onClick={() => set('paye_enabled', !settings.paye_enabled)}
              aria-label="Toggle PAYE"
            >
              <div style={toggleThumb(settings.paye_enabled)} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEE2E2', color: '#DC2626',
            borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#D1FAE5', color: '#059669',
            borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
            ✓ {success}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: saving ? '#9CA3AF' : '#1A3D7C', color: 'white',
              fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer',
            }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
