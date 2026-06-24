export type Tab = 'inbox' | 'children' | 'staff' | 'payslips' | 'settings';

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'inbox',    icon: '📬', label: 'Inbox'    },
  { id: 'children', icon: '👶', label: 'Children' },
  { id: 'staff',    icon: '👩‍💼', label: 'Staff'    },
  { id: 'payslips', icon: '💰', label: 'Payslips' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function BottomNav({ active, onSelect }: Props) {
  return (
    <nav style={{
      background: '#1A3D7C',
      display: 'flex',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, padding: '8px 4px',
              cursor: 'pointer',
              borderTop: isActive ? '2px solid #F59E0B' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: '0.62rem', fontWeight: isActive ? 700 : 500,
              color: isActive ? '#F59E0B' : 'rgba(255,255,255,0.5)',
              letterSpacing: '0.03em',
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
