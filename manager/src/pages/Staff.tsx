import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Staff() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.getStaff().then(setStaff).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Staff</h2>
          <p>Manage daycare staff records, salaries, and contact details.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>➕ Add Staff Member</button>
      </div>

      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Add New Staff Member</h3>
          <p style={{ color: '#6B7280', marginBottom: 16 }}>Form coming soon. For MVP, use the database or contact ChiefOps support.</p>
          <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Close</button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p>Loading staff...</p>
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
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.staff_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{s.full_name}</td>
                  <td style={{ padding: '12px 8px' }}>{s.job_title}</td>
                  <td style={{ padding: '12px 8px' }}>{s.email || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{s.phone || '-'}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>R {Number(s.basic_salary).toLocaleString()}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 600,
                      background: s.active ? '#D1FAE5' : '#FEE2E2',
                      color: s.active ? '#059669' : '#DC2626'
                    }}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
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
