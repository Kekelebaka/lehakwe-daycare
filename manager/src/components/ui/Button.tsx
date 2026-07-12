import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'success';
  block?: boolean;
}

export default function Button({ variant = 'primary', block = false, className = '', ...rest }: ButtonProps) {
  return <button className={`btn btn-${variant}${block ? ' btn-block' : ''}${className ? ` ${className}` : ''}`} {...rest} />;
}
