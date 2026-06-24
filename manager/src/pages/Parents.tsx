import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const EMPTY_FORM = {
  full_name: '', phone: '', email: '', address: '',
  relationship_to_child: '', emergency_contact: false, notes: '',
};

export default function Parents() {
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadParents = () => {
    setLoading(true);
    api.getParents()
      .then(setParents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadParents(); }, []);

  const set = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEdit = (parent: any) => {
    setEditingId(parent.parent_id);
    setForm({
      full_name: parent.full_name || '',
      phone: parent.phone || '',
      email: parent.email || '',
      address: parent.address || '',
      relationship_to_child: parent.relationship_to_child || '',
      emergency_contact: !!parent.emergency_contact,
      notes: parent.notes || '',
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
      const payload = { ...form, emergency_contact: form.emergency_contact ? 1 : 0 };
      if (editingId) {
        await api.updateParent(editingId, payload);
        setFormSuccess('Parent updated successfully.');
      } else {
        await api.createParent(payload);
        setFormSuccess('Parent added successfully.');
        setForm({ ...EMPTY_FORM });
      }
      loadParents();
      setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteParent(id);
      setConfirmDelete(null);
      loadParents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete parent.');
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
          <h2>Parents</h2>
          <p>Manage parent and guardian contact details.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Parent</button>
      </div>

      {/* ── Add / Edit Parent modal ── */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 32,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{editingId ? 'Edit Parent' : 'Add New Parent'}</h3>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input style={inputStyle} value={form.full_name}
                    onChange={e => set('full_name', e.target.value)} placeholder="e.g. Thabo Mokoena" required />
                </div>

                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone}
                    onChange={e => set('phone', e.target.value)} placeholder="0XX XXX XXXX" />
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={form.email}
                    onChange={e => set('email', e.target.value)} placeholder="parent@gmail.com" />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={form.address}
                    onChange={e => set('address', e.target.value)} placeholder="Street address, city" />
                </div>

                <div>
                  <label style={labelStyle}>Relationship to Child</label>
                  <input style={inputStyle} value={form.relationship_to_child}
                    onChange={e => set('relationship_to_child', e.target.value)} placeholder="e.g. Mother, Father, Guardian" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
                  <input type="checkbox" id="emergency_contact" checked={form.emergency_contact}
                    onChange={e => set('emergency_contact', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  <label htmlFor="emergency_contact" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                    Emergency Contact
                  </label>
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                    value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Any additional notes about this parent" />
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
                  {saving ? 'Saving…' : editingId ? 'Update Parent' : 'Add Parent'}
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
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Delete Parent?</h3>
            <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: 24 }}>
              This action cannot be undone. The parent record will be permanently removed.
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

      {/* ── Parents table ── */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading parents…</p>
        ) : parents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>👨‍👩‍👧</div>
            <p>No parents registered yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Name</th>
                <th style={{ padding: '12px 8px' }}>Phone</th>
                <th style={{ padding: '12px 8px' }}>Email</th>
                <th style={{ padding: '12px 8px' }}>Relationship</th>
                <th style={{ padding: '12px 8px' }}>Emergency</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p: any) => (
                <tr key={p.parent_id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{p.full_name}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{p.phone || '—'}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>{p.email || '—'}</td>
                  <td style={{ padding: '12px 8px' }}>{p.relationship_to_child || '—'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                      background: p.emergency_contact ? '#D1FAE5' : '#F3F4F6',
                      color: p.emergency_contact ? '#059669' : '#6B7280',
                    }}>
                      {p.emergency_contact ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button onClick={() => openEdit(p)} style={{
                      padding: '4px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                      background: 'white', cursor: 'pointer', fontSize: '0.8rem', marginRight: 8,
                    }}>✏️ Edit</button>
                    <button onClick={() => setConfirmDelete(p.parent_id)} style={{
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
