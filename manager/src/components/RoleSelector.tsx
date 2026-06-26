import { useState } from 'react';

type Role = 'admin' | 'staff' | 'parent';

interface RoleSelectorProps {
  onSelect: (role: Role) => void;
}

const roles = [
  {
    key: 'admin' as Role,
    emoji: '🛡️',
    title: 'Admin',
    description: 'Full access to all features',
    color: '#7C3AED',
    bg: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
    features: ['Manage staff & children', 'View reports & documents', 'Handle fees & payroll', 'Full system settings'],
  },
  {
    key: 'staff' as Role,
    emoji: '👩‍🏫',
    title: 'Staff',
    description: 'Attendance, daily logs, inbox, payslips',
    color: '#0B5FB3',
    bg: 'linear-gradient(135deg, #0B5FB3 0%, #084C8F 100%)',
    features: ['Mark attendance', 'Write daily logs', 'View payslips', 'Access inbox'],
  },
  {
    key: 'parent' as Role,
    emoji: '👨‍👩‍👧',
    title: 'Parent',
    description: 'View child info, fees, notices',
    color: '#14B8A6',
    bg: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
    features: ['View child dashboard', 'Check attendance', 'Track milestones', 'See fees & notices'],
  },
];

export default function RoleSelector({ onSelect }: RoleSelectorProps) {
  const [hovered, setHovered] = useState<Role | null>(null);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F0F9FF 0%, #EFF6FF 50%, #F5F3FF 100%)',
      padding: '24px 16px',
    }}>
      {/* Logo & Title */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img
          src="https://i.imgur.com/0COuhlX.png"
          alt="Lehakwe Daycare"
          style={{ height: 64, width: 'auto', marginBottom: 16 }}
        />
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: '#073B73',
          margin: '0 0 8px',
        }}>
          Welcome to Lehakwe
        </h1>
        <p style={{
          fontSize: '1rem',
          color: '#6B7280',
          margin: 0,
        }}>
          Select your role to continue
        </p>
      </div>

      {/* Role Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        maxWidth: 960,
        width: '100%',
      }}>
        {roles.map((role) => {
          const isHovered = hovered === role.key;
          return (
            <button
              key={role.key}
              onClick={() => onSelect(role.key)}
              onMouseEnter={() => setHovered(role.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '32px 24px',
                background: 'white',
                border: `2px solid ${isHovered ? role.color : '#E5E7EB'}`,
                borderRadius: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isHovered
                  ? `0 12px 40px ${role.color}20, 0 4px 12px rgba(0,0,0,0.08)`
                  : '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {/* Icon Circle */}
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: role.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                marginBottom: 16,
                boxShadow: `0 4px 16px ${role.color}30`,
              }}>
                {role.emoji}
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 6px',
              }}>
                {role.title}
              </h2>

              {/* Description */}
              <p style={{
                fontSize: '0.85rem',
                color: '#6B7280',
                margin: '0 0 20px',
                textAlign: 'center',
              }}>
                {role.description}
              </p>

              {/* Features */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                width: '100%',
                padding: '16px',
                background: '#F9FAFB',
                borderRadius: 10,
              }}>
                {role.features.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.82rem',
                    color: '#374151',
                  }}>
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: `${role.color}15`,
                      color: role.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>

              {/* Enter Button */}
              <div style={{
                marginTop: 20,
                padding: '10px 32px',
                background: isHovered ? role.bg : '#F3F4F6',
                color: isHovered ? 'white' : '#374151',
                borderRadius: 10,
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}>
                Enter as {role.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p style={{
        marginTop: 40,
        fontSize: '0.75rem',
        color: '#9CA3AF',
      }}>
        You can switch roles anytime from the app menu
      </p>
    </div>
  );
}
