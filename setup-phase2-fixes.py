#!/usr/bin/env python3
"""
Lehakwe Daycare Manager — Phase 2 Fixes
Run from: /Users/keke/projects/lehakwe-daycare

Fixes:
  manager/src/pages/Dashboard.tsx  — wire real API (getDashboard + getCompliance)
  manager/src/pages/Staff.tsx      — replace stub with real add-staff form
  worker/wrangler.toml             — add app.lehakwedaycare.co.za to ALLOWED_ORIGIN
  worker/src/index.ts              — multi-origin CORS + real /api/me staff lookup
"""

import os, sys

for d in ['manager', 'worker']:
    if not os.path.isdir(d):
        print(f"❌  Run this script from the lehakwe-daycare root. Missing: {d}/")
        sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
DASHBOARD_TSX = '''\
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    staffCount: '--', childrenCount: '--', newInbox: '--', payrollStatus: 'pending',
  });
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getCompliance()])
      .then(([dash, comp]) => {
        setStats(dash);
        setCompliance((comp || []).slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Active Staff',         value: loading ? '…' : stats.staffCount,    icon: '👥', color: '#3B82F6' },
    { label: 'Active Children',      value: loading ? '…' : stats.childrenCount, icon: '👶', color: '#14B8A6' },
    { label: 'New Inbox Messages',   value: loading ? '…' : stats.newInbox,      icon: '✉️', color: '#F59E0B' },
    {
      label: 'Payroll This Month',
      value: loading ? '…' : (stats.payrollStatus === 'paid' ? 'Complete' : 'Pending'),
      icon: '💰',
      color: stats.payrollStatus === 'paid' ? '#14B8A6' : '#F97316',
    },
  ];

  const statusLabel = (s: string) =>
    s === 'complete' ? 'Complete' : s === 'needs_attention' ? 'Attention' : 'Missing';

  const statusStyle = (s: string) => ({
    fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
    background: s === 'complete' ? '#D1FAE5' : s === 'needs_attention' ? '#FEF3C7' : '#FEE2E2',
    color:      s === 'complete' ? '#059669' : s === 'needs_attention' ? '#D97706' : '#DC2626',
  });

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back. Here is your daycare at a glance.</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {cards.map((card, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${card.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{card.value}</div>
              </div>
              <div style={{ fontSize: '2rem', opacity: 0.8 }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/payslips"  className="btn btn-primary"   style={{ justifyContent: 'flex-start' }}>➕ Create Payslip</Link>
            <Link to="/staff"     className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>➕ Add Staff Member</Link>
            <Link to="/inbox"     className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📥 Open Inbox</Link>
            <Link to="/reports"   className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>📑 Generate Monthly Report</Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Compliance Checklist</h3>
          {loading ? (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Loading…</p>
          ) : compliance.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>No compliance items found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {compliance.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.item_name || item.label || item.title}</span>
                  <span style={statusStyle(item.status)}>{statusLabel(item.status)}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/reports" className="btn btn-secondary" style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
            View Full Checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
'''

# ─────────────────────────────────────────────────────────────────────────────
STAFF_TSX = '''\
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const EMPTY_FORM = {
  full_name: '', job_title: '', email: '', phone: '',
  id_number: '', employee_number: '', start_date: '',
  basic_salary: 0, uif_enabled: true, paye_enabled: false,
};

export default function Staff() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return; }
    if (!form.job_title.trim()) { setFormError('Job title is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await api.createStaff({
        ...form,
        basic_salary: Number(form.basic_salary) || 0,
        uif_enabled: form.uif_enabled ? 1 : 0,
        paye_enabled: form.paye_enabled ? 1 : 0,
        signature: `${form.full_name}\\nLehakwe Daycare\\n061 549 1701 | info@lehakwedaycare.co.za`,
      });
      setFormSuccess('Staff member added successfully.');
      setForm({ ...EMPTY_FORM });
      loadStaff();
      setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add staff. Please try again.');
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
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); }}>
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New Staff Member</h3>
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
                  {saving ? 'Saving…' : 'Add Staff Member'}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
'''

# ─────────────────────────────────────────────────────────────────────────────
WRANGLER_TOML = '''\
name = "lehakwe-email-worker"
main = "src/index.ts"
compatibility_date = "2025-06-09"
account_id = "c63d3d6d8c17db7487ab40b81d5e29d1"

[[d1_databases]]
binding = "DB"
database_name = "lehakwe-db"
database_id = "aaafb847-a046-4bf1-8325-d41e6244a505"

[[r2_buckets]]
binding = "EMAIL_STORE"
bucket_name = "lehakwe-emails"

[vars]
FORWARD_EMAILS = "nolaphamorakabee@gmail.com,sophylebaka@gmail.com"
AUTO_REPLY_ENABLED = "true"
SENDING_DOMAIN = "lehakwedaycare.co.za"
ALLOWED_ORIGIN = "https://mail.lehakwedaycare.co.za,https://app.lehakwedaycare.co.za"
'''

# ─────────────────────────────────────────────────────────────────────────────
# Read current worker/src/index.ts and apply targeted patches
WORKER_INDEX_PATCHES = [
    # Patch 1: Multi-origin CORS (replace single-origin header with dynamic lookup)
    (
        "      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,",
        """\
      'Access-Control-Allow-Origin': (() => {
        const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((o: string) => o.trim());
        const origin = request.headers.get('Origin') || '';
        return allowed.includes(origin) ? origin : allowed[0] || '*';
      })(),"""
    ),
    # Patch 2: /api/me — real staff lookup instead of hardcoded Admin
    (
        """\
      // ── GET /api/me ──
      if (path === '/api/me' && request.method === 'GET') {
        const email = request.headers.get('Cf-Access-Authenticated-User-Email') || 'kekelebaka@outlook.com';
        // Fallback for development/testing without Access
        return Response.json({ ok: true, data: { name: 'Admin', email, role: 'owner' } }, { headers: corsHeaders });
      }""",
        """\
      // ── GET /api/me ──
      if (path === '/api/me' && request.method === 'GET') {
        const email = request.headers.get('Cf-Access-Authenticated-User-Email');
        if (!email) {
          // Dev fallback — only works when Cloudflare Access is not enforcing
          return Response.json({ ok: true, data: { id: 'dev-admin', name: 'Dev Admin', email: 'admin@lehakwedaycare.co.za', role: 'admin', signature: '', active: 1 } }, { headers: corsHeaders });
        }
        const staffRow = await db.DB.prepare(
          'SELECT * FROM staff WHERE email = ? AND active = 1 LIMIT 1'
        ).bind(email).first<any>();
        if (!staffRow) {
          return Response.json({ ok: false, error: 'Access denied — staff record not found for ' + email }, { status: 403, headers: corsHeaders });
        }
        return Response.json({ ok: true, data: {
          id: staffRow.staff_id,
          name: staffRow.full_name,
          email: staffRow.email,
          role: (staffRow.job_title === 'Centre Manager' || staffRow.job_title === 'Daycare Principal') ? 'admin' : 'staff',
          signature: staffRow.signature || '',
          active: staffRow.active,
        }}, { headers: corsHeaders });
      }"""
    ),
]

# ─────────────────────────────────────────────────────────────────────────────
FILES = {
    'manager/src/pages/Dashboard.tsx': DASHBOARD_TSX,
    'manager/src/pages/Staff.tsx':     STAFF_TSX,
    'worker/wrangler.toml':            WRANGLER_TOML,
}

print('\n🛡️  Lehakwe Manager — Phase 2 Fixes\n')
ok = 0

for path, content in FILES.items():
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✅  {path}')
        ok += 1
    except Exception as e:
        print(f'  ❌  {path}  →  {e}')

# Apply targeted patches to worker/src/index.ts
worker_path = 'worker/src/index.ts'
try:
    with open(worker_path, 'r', encoding='utf-8') as f:
        content = f.read()

    patched = 0
    for old, new in WORKER_INDEX_PATCHES:
        if old in content:
            content = content.replace(old, new, 1)
            patched += 1
        else:
            print(f'  ⚠️   Patch not applied (text not found): {old[:60]}...')

    with open(worker_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'  ✅  {worker_path} ({patched}/{len(WORKER_INDEX_PATCHES)} patches applied)')
    ok += 1
except Exception as e:
    print(f'  ❌  {worker_path}  →  {e}')

total = len(FILES) + 1
print(f'\n{ok}/{total} files updated.\n')

if ok == total:
    print('Next steps:')
    print()
    print('  1. git add -A && git commit -m "fix: Dashboard real API, Staff add form, worker CORS + /api/me" && git push')
    print()
    print('  2. cd worker && wrangler deploy && cd ..')
    print()
    print('  3. Get your worker URL (needed for step 4):')
    print('     cd worker && wrangler deployments list | head -5 && cd ..')
    print()
    print('  4. Set VITE_API_URL for the manager build (replace <WORKER_URL> with the URL from step 3):')
    print('     echo "VITE_API_URL=<WORKER_URL>" > manager/.env.local')
    print()
    print('  5. cd manager && npm install && npm run build')
    print('     wrangler pages deploy dist --project-name=lehakwe-manager')
    print('     cd ..')
    print()
    print('  6. Add custom domain in Cloudflare Pages:')
    print('     Dashboard → Pages → lehakwe-manager → Custom domains → app.lehakwedaycare.co.za')
    print()
