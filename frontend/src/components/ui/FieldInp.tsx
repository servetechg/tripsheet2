import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';
import { formatPhoneInput, PHONE_INPUT_MAX_LENGTH } from '@/lib/phoneFormat';
import { Icons } from './Icons';

export interface FieldInpProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  hint?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  phone?: boolean;
  passwordToggle?: boolean;
}

/** Styled input with optional inline error (extends Inp pattern). */
export function FieldInp({
  label,
  error,
  hint,
  style: sx,
  inputStyle,
  phone,
  passwordToggle,
  type = 'text',
  onChange,
  maxLength,
  ...p
}: FieldInpProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const showToggle = isPassword && passwordToggle !== false;
  const resolvedType =
    isPassword && showToggle && showPassword ? 'text' : type;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (phone) {
      const formatted = formatPhoneInput(e.target.value);
      if (formatted === e.target.value) {
        onChange?.(e);
        return;
      }
      onChange?.({
        ...e,
        target: { ...e.target, value: formatted },
        currentTarget: { ...e.currentTarget, value: formatted },
      });
      return;
    }
    onChange?.(e);
  };

  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          style={{
            ...inputBase(),
            borderColor: error ? G.danger : G.border2,
            boxShadow: error ? `0 0 0 1px ${G.danger}55` : undefined,
            ...(showToggle ? { paddingRight: 40 } : {}),
            ...inputStyle,
          }}
          type={resolvedType}
          onChange={handleChange}
          maxLength={phone ? PHONE_INPUT_MAX_LENGTH : maxLength}
          {...(phone
            ? { inputMode: 'tel' as const, autoComplete: p.autoComplete ?? 'tel' }
            : {})}
          {...p}
        />
        {showToggle ? (
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: G.muted,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showPassword
              ? Icons.eyeOff({ size: 20, color: G.muted })
              : Icons.eye({ size: 20, color: G.muted })}
          </button>
        ) : null}
      </div>
      {error ? (
        <div style={{ fontSize: 11, color: G.danger, marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}
