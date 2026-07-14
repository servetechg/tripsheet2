import type { CSSProperties, SelectHTMLAttributes, ReactNode } from 'react';
import { inputBase, labelBase } from '@/lib/theme';

export interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Sel({ label, children, style: sx, ...p }: SelProps) {
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <select style={{ ...inputBase(), appearance: 'none', cursor: 'pointer' }} {...p}>
        {children}
      </select>
    </div>
  );
}
