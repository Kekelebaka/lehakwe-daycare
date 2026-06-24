import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function TownDashboard() {
  const [config, setConfig] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTownConfig(), api.getTownStats()])
      .then(([c, s]) => { setConfig(c); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#6B7280' }}>Loading Ubuntu Town data...</div>;

  const town = config[0];

  return (
    <div>
      <div className="page-header">
        <h2>🏙️ Ubuntu Town Dashboard</h2>
        <p>Lehakwe Daycare's place in the Ubuntu Town network</p>
      </div>

      {/* Town Identity Card */}
      <div className="card" style={{ borderLeft: '4px solid #7C3AED', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #7C3AED, #0B5FB3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white', fontWeight: 700 }}>
            🏙️
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{town?.town_name || 'Bloemfontein'}</h3>
            <p style={{ fontSize: '0.8rem', color: '#6B7280' }}>{town?.tagline || 'Part of the Ubuntu Town Network'}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
          <div><strong>Coordinator:</strong> {town?.coordinator_name || '—'}</div>
          <div><strong>Contact:</strong> {town?.coordinator_phone || '—'}</div>
        </div>
      </div>

      {/* Centre Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0B5FB3' }}>{stats?.total_centres || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Active Centres</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>{stats?.total_children || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Children Enrolled</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F59E0B' }}>{stats?.total_staff || 0}</div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Staff Members</div>
        </div>
      </div>

      {/* Ecosystem Links */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Ubuntu Town Ecosystem</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="card" style={{ borderLeft: '3px solid #059669' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>🏠</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>FamilyHouse ECD</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>White-label ECD OS for every daycare</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid #2563EB' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>📰</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Inside.Town Feed</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>ECD jobs, notices, and centre news</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid #7C3AED' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>🤖</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>AI Café Intelligence</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Grant alerts, deadlines, policy changes</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid #F59E0B' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>🎓</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Ubuntu Academy</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>ECD practitioner training courses</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid #0B5FB3' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>📊</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Town Dashboard</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>Executive overview for coordinators</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid #EC4899' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>🔨</div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Kopano Forge AI</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>CV, letter, and document generation</div>
          </div>
        </div>
      </div>

      {/* White-Label Deploy Info */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>🚀 White-Label Deploy</h3>
        <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: 12 }}>
          Every new Ubuntu Town centre gets a 5-minute deploy. Same codebase, different branding.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <div style={{ padding: 12, background: '#F3F4F6', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>R7,500</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Community Pilot Setup</div>
          </div>
          <div style={{ padding: 12, background: '#F3F4F6', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563EB' }}>R12,500</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Standard Centre Setup</div>
          </div>
          <div style={{ padding: 12, background: '#F3F4F6', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED' }}>R18,500</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Full OS Setup</div>
          </div>
          <div style={{ padding: 12, background: '#F3F4F6', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F59E0B' }}>R250/mo</div>
            <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>Per Centre / Month</div>
          </div>
        </div>
      </div>
    </div>
  );
}
