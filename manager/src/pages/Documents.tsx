import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const DOC_TYPES = ['Birth Certificate', 'Immunisation Card', 'ID Copy', 'Contract', 'Registration Form', 'Consent Form', 'Other'];
const ENTITY_TYPES = ['centre', 'child', 'parent', 'staff'];

const EMPTY_FORM = {
  title: '', document_type: DOC_TYPES[0], related_entity_type: 'centre',
  related_entity_id: '', expiry_date: '', file_url: '', status: 'active',
};

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [filter, setFilter] = useState('all');
  const [file, setFile] = useState<File | null>(null);

  const loadDocuments = () => {
    setLoading(true);
    api.getDocuments()
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDocuments(); }, []);

  const set = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!file && !form.file_url.trim()) { setFormError('Attach a file or paste a file URL.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (file) {
        await api.uploadDocument(file, {
          title: form.title, document_type: form.document_type,
          related_entity_type: form.related_entity_type, related_entity_id: form.related_entity_id,
          expiry_date: form.expiry_date,
        });
      } else {
        await api.createDocument({
          ...form,
          status: form.expiry_date && new Date(form.expiry_date) < new Date() ? 'expired' : 'active',
        });
      }
      setFormSuccess('Document saved successfully.');
      setForm({ ...EMPTY_FORM });
      setFile(null);
      loadDocuments();
      setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(id);
      loadDocuments();
    } catch {
      alert('Failed to delete document.');
    }
  };

  const filteredDocs = filter === 'all'
    ? documents
    : documents.filter(d => d.related_entity_type === filter);

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      active:  { bg: '#D1FAE5', color: '#059669' },
      expired: { bg: '#FEE2E2', color: '#DC2626' },
      pending: { bg: '#FEF3C7', color: '#D97706' },
    };
    const s = map[status] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
        background: s.bg, color: s.color, textTransform: 'capitalize',
      }}>
        {status}
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
          <h2>Documents</h2>
          <p>Manage documents for children, parents, and staff.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); }}>
          ➕ Add Document
        </button>
      </div>

      {/* ── Add document modal ── */}
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New Document</h3>
              <button onClick={() => setShowForm(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Title *</label>
                  <input style={inputStyle} value={form.title}
                    onChange={e => set('title', e.target.value)} placeholder="e.g. Birth Certificate for Thabo" required />
                </div>

                <div>
                  <label style={labelStyle}>Document Type *</label>
                  <select style={inputStyle} value={form.document_type}
                    onChange={e => set('document_type', e.target.value)}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Related Entity Type *</label>
                  <select style={inputStyle} value={form.related_entity_type}
                    onChange={e => set('related_entity_type', e.target.value)}>
                    {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Related Entity ID</label>
                  <input style={inputStyle} value={form.related_entity_id}
                    onChange={e => set('related_entity_id', e.target.value)}
                    placeholder="Child/parent/staff ID (blank = centre)" />
                </div>

                <div>
                  <label style={labelStyle}>Expiry Date</label>
                  <input style={inputStyle} type="date" value={form.expiry_date}
                    onChange={e => set('expiry_date', e.target.value)} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Upload file (PDF, image, Word — max 15MB)</label>
                  <input style={inputStyle} type="file" accept=".pdf,image/*,.doc,.docx,.txt"
                    onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>…or paste a file URL</label>
                  <input style={inputStyle} value={form.file_url}
                    onChange={e => set('file_url', e.target.value)}
                    placeholder="https://..." />
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
                  {saving ? 'Saving…' : 'Add Document'}
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

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', ...ENTITY_TYPES].map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            style={{
              padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
              background: filter === tab ? '#1A3D7C' : '#F3F4F6',
              color: filter === tab ? 'white' : '#374151',
              textTransform: 'capitalize',
            }}>
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Documents table ── */}
      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: '#6B7280' }}>Loading documents…</p>
        ) : filteredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
            <p>No documents found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Title</th>
                <th style={{ padding: '12px 8px' }}>Type</th>
                <th style={{ padding: '12px 8px' }}>Entity Type</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px' }}>Expiry Date</th>
                <th style={{ padding: '12px 8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((d: any) => (
                <tr key={d.document_id} style={{ borderBottom: '1px solid #F3F4F6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{d.title}</td>
                  <td style={{ padding: '12px 8px' }}>{d.document_type}</td>
                  <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{d.related_entity_type}</td>
                  <td style={{ padding: '12px 8px' }}>{statusBadge(d.status)}</td>
                  <td style={{ padding: '12px 8px', color: '#6B7280' }}>
                    {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {d.file_url ? (
                        <a href={api.documentFileUrl(d.document_id)} target="_blank" rel="noopener noreferrer"
                          style={{ padding: '4px 10px', borderRadius: 6, background: '#EFF6FF', color: '#1A3D7C', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                          👁 View
                        </a>
                      ) : null}
                      <button onClick={() => handleDelete(d.document_id)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: '#FEE2E2', color: '#DC2626', fontSize: '0.8rem', fontWeight: 600,
                        }}>
                        🗑 Delete
                      </button>
                    </div>
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
