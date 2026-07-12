import type { ReactNode } from 'react';

interface BadgeProps {
  tone?: 'success' | 'warning' | 'danger' | 'brand' | 'neutral';
  children: ReactNode;
}

export default function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`ub-badge ub-badge-${tone}`}>{children}</span>;
}
