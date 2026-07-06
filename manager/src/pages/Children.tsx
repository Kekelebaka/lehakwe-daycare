import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const AGE_GROUPS = ['Baby (6-18 mo)', 'Toddler (18 mo-3 yr)', 'Grade R (3-4 yr)'];
const STATUSES = ['active', 'inactive', 'graduated'];
const GENDERS = ['', 'male', 'female'];
const RACES = ['', 'african', 'coloured', 'asian', 'white', 'other'];
const INCOME_CATS = ['', 'single_parent', 'dual_parent', 'other'];

const EMPTY_FORM = {
  full_name: '', date_of_birth: '', age_group: AGE_GROUPS[0],
  enrolment_date: '', parent_id: '', emergency_contacts: '',
  medical_notes: '', allergies: '', pickup_notes: '', status: 'active',
  gender: '', race: '', disability: 'no', disability_description: '',
  income_category: '', id_number: '',
};

export default function Children() {
  const [children, setChildren] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [qrChild, setQrChild] = useState<any | null>(null);

  const PARENT_PORTAL_BASE = 'https://app.lehakwedaycare.co.za/parent';

  const loadData = () => {
    setLoading(true);
    Promise.all([api.getChildren(), api.getParents()])
      .then(([c, p]) => { setChildren(c); setParents(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const set = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEdit = (child: any) => {
    setEditingId(child.child_id);
    setForm({
      full_name: child.full_name || '',
      date_of_birth: child.date_of_birth || '',
      age_group: child.age_group || AGE_GROUPS[0],
      enrolment_date: child.enrolment_date || '',
      parent_id: child.parent_id || '',
      emergency_contacts: child.emergency_contacts || '',
      medical_notes: child.medical_notes || '',
      allergies: child.allergies || '',
      pickup_notes: child.pickup_notes || '',
      status: child.status || 'active',
      gender: child.gender || '',
      race: child.race || '',
      disability: child.disability || 'no',
      disability_description: child.disability_description || '',
      income_category: child.income_category || '',
      id_number: child.id_number || '',
    });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.updateChild(editingId, form);
        setFormSuccess('Child updated successfully.');
      } else {
        await api.createChild(form);
        setFormSuccess('Child added successfully.');
        setForm({ ...EMPTY_FORM });
      }
      loadData();
      setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteChild(id);
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete child.');
    }
  };

  const getParentName = (parentId: string) => {
    const p = parents.find((p: any) => p.parent_id === parentId);
    return p ? p.full_name : '—';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      active:    { bg: '#D1FAE5', fg: '#059669' },
      inactive:  { bg: '#F3F4F6', fg: '#6B7280' },
      graduated: { bg: '#DBEAFE', fg: '#2563EB' },
    };
    const c = colors[status] || colors.active;
    return (
      <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.fg }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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
          <h2>Children</h2>
          <p>Manage child records, age groups, and emergency contacts.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Child</button>
      </div>

      {/* ── Add / Edit Child modal ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{editingId ? 'Edit Child' : 'Add New Child'}</h3>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} value={form.full_name}
                    onChange={e => set('full_name', e.target.value)} placeholder="e.g. Lerato Mokoena" required />
                </div>

                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input style={inputStyle} type="date" value={form.date_of_birth}
                    onChange={e => set('date_of_birth', e.target.value)} />
                </div>

                <div>
                  <label style={labelStyle}>Age Group *</label>
                  <select style={inputStyle} value={form.age_group}
                    onChange={e => set('age_group', e.target.value)}>
                    {AGE_GROUPS.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Enrolment Date</label>
                  <input style={inputStyle} type="date" value={form.enrolment_date}
                    onChange={e => set('enrolment_date', e.target.value)} />
                </div>

                <div>
                  <label style={labelStyle}>Parent / Guardian</label>
                  <select style={inputStyle} value={form.parent_id}
                    onChange={e => set('parent_id', e.target.value)}>
                    <option value="">— Select parent —</option>
                    {parents.map((p: any) => (
                      <option key={p.parent_id} value={p.parent_id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={form.status}
                    onChange={e => set('status', e.target.value)}>
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* ── DSD Demographic Fields ── */}
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid #E5E7EB', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0B5FB3', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📋 DSD Reporting Fields
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>ID Number</label>
                  <input style={inputStyle} value={form.id_number}
                    onChange={e => set('id_number', e.target.value)}
                    placeholder="SA ID number" />
                </div>

                <div>
                  <label style={labelStyle}>Gender</label>
                  <select style={inputStyle} value={form.gender}
                    onChange={e => set('gender', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Race</label>
                  <select style={inputStyle} value={form.race}
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
                  <label style={labelStyle}>Income Category</label>
                  <select style={inputStyle} value={form.income_category}
                    onChange={e => set('income_category', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="single_parent">1 Parent earning R0-R3500</option>
                    <option value="dual_parent">2 Parents earning R0-R4500</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Disability</label>
                  <select style={inputStyle} value={form.disability}
                    onChange={e => set('disability', e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>

                {form.disability === 'yes' && (
                  <div>
                    <label style={labelStyle}>Disability Description</label>
                    <input style={inputStyle} value={form.disability_description}
                      onChange={e => set('disability_description', e.target.value)}
                      placeholder="Describe the disability" />
                  </div>
                )}

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Emergency Contacts</label>
                  <input style={inputStyle} value={form.emergency_contacts}
                    onChange={e => set('emergency_contacts', e.target.value)}
                    placeholder="Names & phone numbers, separated by commas" />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Medical Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                    value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)}
                    placeholder="Any medical conditions or medications" />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Allergies</label>
                  <input style={inputStyle} value={form.allergies}
                    onChange={e => set('allergies', e.target.value)}
                    placeholder="Food, medication, or other allergies" />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Pickup Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                    value={form.pickup_notes} onChange={e => set('pickup_notes', e.target.value)}
                    placeholder="Special pickup instructions or authorised persons" />
                </div>
              </div>

              {formError && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEE2E2', color: '#DC2626',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>{formError}</div>
              )}
              {formSuccess && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#D1FAE5', color: '#059669',
                  borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>✓ {formSuccess}</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button type="submit" disabled={saving} style={{
                  flex: 1, padding: 12, borderRadius: 10, border: 'none',
                  background: saving ? '#9CA3AF' : '#1A3D7C', color: 'white',
                  fontWeight: 700, fontSize: '0.95rem', cursor: saving ? 'default' : 'pointer',
                }}>
                  {saving ? 'Saving…' : editingId ? 'Update Child' : 'Add Child'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '12px 20px', borderRadius: 10, border: '1px solid #E5E7EB',
                  background: 'white', cursor: 'pointer', fontSize: '0.95rem',
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Delete Child?</h3>
            <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: 24 }}>
              This action cannot be undone. The child record will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleDelete(confirmDelete)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: '#EF4444', color: 'white', fontWeight: 700, cursor: 'pointer',
              }}>Delete</button>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E5E7EB',
                background: 'white', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Code modal ── */}
      {qrChild && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>📱 Parent Portal QR Code</h3>
            <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16 }}>Scan to view {qrChild.full_name}'s portal</p>
            <div style={{ display: 'inline-block', padding: 12, background: 'white', borderRadius: 8, border: '1px solid #E5E7EB' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${PARENT_PORTAL_BASE}/${qrChild.child_id}`)}&bgcolor=FFFFFF&color=0B5FB3`}
                alt={`QR for ${qrChild.full_name}`}
                width={200} height={200}
                style={{ display: 'block' }}
              />
            </div>
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#F3F4F6', borderRadius: 6, fontSize: '0.75rem', color: '#6B7280', wordBreak: 'break-all' }}>
              {PARENT_PORTAL_BASE}/{qrChild.child_id}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={() => {
                navigator.clipboard?.writeText(`${PARENT_PORTAL_BASE}/${qrChild.child_id}`);
              }} style={{
                flex: 1, padding: 12, borderRadius: 10, border: '1px solid #E5E7EB',
                background: 'white', cursor: 'pointer', fontWeight: 600,
              }}>📋 Copy Link</button>
              <button onClick={() => setQrChild(null)} style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: '#0B5FB3', color: 'white', cursor: 'pointer', fontWeight: 600,
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Children table ── */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading children…</p>
        ) : children.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>👶</div>
            <p>No children registered yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Name</th>
                <th style={{ padding: '12px 8px' }}>Age Group</th>
                <th style={{ padding: '12px 8px' }}>Parent</th>
                <th style={{ padding: '12px 8px' }}>Enrolment</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c: any) => (
                <tr key={c.child_id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{c.full_name}</td>
                  <td style={{ padding: '12px 8px' }}>{c.age_group}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{getParentName(c.parent_id)}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{c.enrolment_date || '—'}</td>
                  <td style={{ padding: '12px 8px' }}>{statusBadge(c.status || 'active')}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => openEdit(c)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                      background: 'white', cursor: 'pointer', fontSize: '0.8rem', marginRight: 8,
                    }}>✏️ Edit</button>
                    <button onClick={() => setQrChild(c)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid #BFDBFE',
                      background: '#EFF6FF', cursor: 'pointer', fontSize: '0.8rem', marginRight: 8, color: '#0B5FB3',
                    }}>📱 QR</button>
                    <button onClick={() => setConfirmDelete(c.child_id)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid #FECACA',
                      background: '#FEF2F2', cursor: 'pointer', fontSize: '0.8rem', color: '#DC2626',
                    }}>🗑️ Delete</button>
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
