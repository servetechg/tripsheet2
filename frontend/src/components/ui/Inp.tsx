import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';

export interface InpProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}

export function Inp({ label, style: sx, inputStyle, ...p }: InpProps) {
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <input style={{ ...inputBase(), ...inputStyle }} {...p} />
    </div>
  );
}
