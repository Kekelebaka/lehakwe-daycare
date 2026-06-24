interface Props {
  icon: string;
  title: string;
  desc: string;
}

export default function ComingSoon({ icon, title, desc }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center',
      minHeight: 300,
    }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1.3rem', marginBottom: 8 }}>{title}</div>
      <div style={{ color: '#6B7280', fontSize: '0.9rem', maxWidth: 280, lineHeight: 1.6, marginBottom: 20 }}>
        {desc}
      </div>
      <div style={{
        background: '#EEF2FF', color: '#3730A3', padding: '6px 16px',
        borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        Coming in Phase 2
      </div>
    </div>
  );
}
