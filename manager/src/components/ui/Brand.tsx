interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
  onDark?: boolean;
  powered?: boolean;
}

const SIZES: Record<string, string> = { sm: '1rem', md: '1.3rem', lg: '1.75rem' };

// The Ubuntu Daycare OS wordmark. Colour-coded (Ubuntu=purple, Daycare=orange, OS=teal)
// to match the brand logo; needs no external image, so it works everywhere and themes cleanly.
export default function Brand({ size = 'md', onDark = false, powered = false }: BrandProps) {
  return (
    <span className={`ub-brand${onDark ? ' on-dark' : ''}`} style={{ fontSize: SIZES[size] }}>
      <span className="ub-brand-u">Ubuntu</span>
      <span className="ub-brand-d">Daycare</span>
      <span className="ub-brand-os">OS</span>
      {powered && <span className="ub-brand-powered">Powered by ChiefOps</span>}
    </span>
  );
}
