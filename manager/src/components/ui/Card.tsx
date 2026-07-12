import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

export default function Card({ children, accent, className = '', style }: CardProps) {
  return (
    <div className={`card${className ? ` ${className}` : ''}`} style={{ ...(accent ? { borderLeft: `4px solid ${accent}` } : {}), ...style }}>
      {children}
    </div>
  );
}
