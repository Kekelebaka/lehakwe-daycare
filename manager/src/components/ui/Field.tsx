import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Field({ label, ...input }: FieldProps) {
  return (
    <label className="ub-field">
      <span className="ub-field-label">{label}</span>
      <input className="ub-field-input" {...input} />
    </label>
  );
}
