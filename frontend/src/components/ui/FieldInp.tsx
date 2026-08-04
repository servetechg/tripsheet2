import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';

export interface FieldInpProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
}

/** Styled input with optional inline error (extends Inp pattern). */
export function FieldInp({
  label,
  error,
  hint,
  style: sx,
  inputStyle,
  ...p
}: FieldInpProps) {
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <input
        style={{
          ...inputBase(),
          borderColor: error ? G.danger : G.border2,
          boxShadow: error ? `0 0 0 1px ${G.danger}55` : undefined,
          ...inputStyle,
        }}
        {...p}
      />
      {error ? (
        <div style={{ fontSize: 11, color: G.danger, marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}
