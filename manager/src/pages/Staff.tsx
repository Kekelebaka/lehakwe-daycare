import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const EMPTY_FORM = {
  full_name: '', job_title: '', email: '', phone: '',
  id_number: '', employee_number: '', start_date: '',
  basic_salary: 0, uif_enabled: true, paye_enabled: false,
  gender: '', race: '', disability: 'no', disability_description: '',
  training_received: '', training_type: '', subsidised: 1,
};

export default function Staff() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadStaff = () => {
    setLoading(true);
    api.getStaff()
      .then(setStaff)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStaff(); }, []);

  const set = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.staff_id);
    setForm({
      full_name: s.full_name || '',
      job_title: s.job_title || '',
      email: s.email || '',
      phone: s.phone || '',
      id_number: s.id_number || '',
      employee_number: s.employee_number || '',
      start_date: s.start_date || '',
      basic_salary: s.basic_salary || 0,
      uif_enabled: !!s.uif_enabled,
      paye_enabled: !!s.paye_enabled,
      gender: s.gender || '',
      race: s.race || '',
      disability: s.disability || 'no',
      disability_description: s.disability_description || '',
      training_received: s.training_received || '',
      training_type: s.training_type || '',
      subsidised: s.subsidised ?? 1,
    });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return; }
    if (!form.job_title.trim()) { setFormError('Job title is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        basic_salary: Number(form.basic_salary) || 0,
        uif_enabled: form.uif_enabled ? 1 : 0,
        paye_enabled: form.paye_enabled ? 1 : 0,
        signature: `${form.full_name}\nLehakwe Daycare\n061 549 1701 | info@lehakwedaycare.co.za`,
      };
      if (editingId) {
        await api.updateStaff(editingId, payload);
        setFormSuccess('Staff member updated successfully.');
      } else {
        await api.createStaff(payload);
        setFormSuccess('Staff member added successfully.');
        setForm({ ...EMPTY_FORM });
      }
      loadStaff();
      setTimeout(() => { setShowForm(false); setFormSuccess(''); setEditingId(null); }, 1500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save staff. Please try again.');
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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Staff</h2>
          <p>Manage daycare staff records, salaries, and contact details.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          ➕ Add Staff Member
        </button>
      </div>

      {/* ── Add staff form ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{editingId ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} value={form.full_name}
                    onChange={e => set('full_name', e.target.value)} placeholder="e.g. Nolaphamo Rakabee" required />
                </div>

                <div>
                  <label style={labelStyle}>Job Title *</label>
                  <input style={inputStyle} value={form.job_title}
                    onChange={e => set('job_title', e.target.value)} placeholder="e.g. Caregiver" required />
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email}
                    onChange={e => set('email', e.target.value)} placeholder="staff@gmail.com" />
                </div>

                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone}
                    onChange={e => set('phone', e.target.value)} placeholder="0XX XXX XXXX" />
                </div>

                <div>
                  <label style={labelStyle}>Basic Salary (R)</label>
                  <input style={inputStyle} type="number" min="0" step="100"
                    value={form.basic_salary}
                    onChange={e => set('basic_salary', e.target.value)} placeholder="0.00" />
                </div>

                <div>
                  <label style={labelStyle}>ID Number</label>
                  <input style={inputStyle} value={form.id_number}
                    onChange={e => set('id_number', e.target.value)} placeholder="SA ID number" />
                </div>

                <div>
                  <label style={labelStyle}>Employee Number</label>
                  <input style={inputStyle} value={form.employee_number}
                    onChange={e => set('employee_number', e.target.value)} placeholder="Optional" />
                </div>

                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input style={inputStyle} type="date" value={form.start_date}
                    onChange={e => set('start_date', e.target.value)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="uif" checked={form.uif_enabled}
                    onChange={e => set('uif_enabled', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <label htmlFor="uif" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>UIF Enabled (1% of salary)</label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="paye" checked={form.paye_enabled}
                    onChange={e => set('paye_enabled', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <label htmlFor="paye" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>PAYE Enabled</label>
                </div>

                {/* ── DSD Demographic Fields ── */}
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid #E5E7EB', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0B5FB3', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📋 DSD Reporting Fields
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Gender</label>
                  <select style={inputStyle} value={(form as any).gender || ''}
                    onChange={e => set('gender', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Race</label>
                  <select style={inputStyle} value={(form as any).race || ''}
                    onChange={e => set('race', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="african">African</option>
                    <option value="coloured">Coloured</option>
                    <option value="asian">Asian</option>
                    <option value="white">White</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Disability</label>
                  <select style={inputStyle} value={(form as any).disability || 'no'}
                    onChange={e => set('disability', e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Subsidised</label>
                  <select style={inputStyle} value={(form as any).subsidised !== undefined ? String((form as any).subsidised) : '1'}
                    onChange={e => set('subsidised', Number(e.target.value))}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Training Received</label>
                  <input style={inputStyle} value={(form as any).training_received || ''}
                    onChange={e => set('training_received', e.target.value)}
                    placeholder="e.g. Yes, N/A" />
                </div>

                <div>
                  <label style={labelStyle}>Training Type</label>
                  <input style={inputStyle} value={(form as any).training_type || ''}
                    onChange={e => set('training_type', e.target.value)}
                    placeholder="e.g. ECD Level 5" />
                </div>
              </div>

              {formError && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEE2E2', color: '#DC2626',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#D1FAE5', color: '#059669',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
                  ✓ {formSuccess}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="submit" disabled={saving}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                    background: saving ? '#9CA3AF' : '#1A3D7C', color: 'white',
                    fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer',
                  }}>
                  {saving ? 'Saving…' : editingId ? 'Update Staff' : 'Add Staff Member'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{
                    padding: '12px 20px', borderRadius: 10, border: '1px solid #E5E7EB',
                    background: 'white', cursor: 'pointer', fontSize: '0.95rem',
                  }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Staff table ── */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading staff…</p>
        ) : staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>👥</div>
            <p>No staff members added yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Name</th>
                <th style={{ padding: '12px 8px' }}>Job Title</th>
                <th style={{ padding: '12px 8px' }}>Email</th>
                <th style={{ padding: '12px 8px' }}>Phone</th>
                <th style={{ padding: '12px 8px' }}>Basic Salary</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => (
                <tr key={s.staff_id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{s.full_name}</td>
                  <td style={{ padding: '12px 8px' }}>{s.job_title}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{s.email || '—'}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{s.phone || '—'}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                    R {Number(s.basic_salary || 0).toLocaleString('en-ZA')}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                      background: s.active ? '#D1FAE5' : '#FEE2E2',
                      color:      s.active ? '#059669' : '#DC2626',
                    }}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => openEdit(s)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                      background: 'white', cursor: 'pointer', fontSize: '0.8rem',
                    }}>✏️ Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
