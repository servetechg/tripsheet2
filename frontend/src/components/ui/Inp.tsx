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

export interface InpProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  /** Auto-format North American phone numbers as (XXX) XXX-XXXX */
  phone?: boolean;
  /** Show eye toggle for password fields (default true when type=password) */
  passwordToggle?: boolean;
}

export function Inp({
  label,
  hint,
  style: sx,
  inputStyle,
  phone,
  passwordToggle,
  type = 'text',
  onChange,
  maxLength,
  ...p
}: InpProps) {
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

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {
    ...p,
    type: resolvedType,
    onChange: handleChange,
    maxLength: phone ? PHONE_INPUT_MAX_LENGTH : maxLength,
    ...(phone
      ? { inputMode: 'tel', autoComplete: p.autoComplete ?? 'tel' }
      : {}),
  };

  const inputEl = (
    <input
      style={{
        ...inputBase(),
        ...(showToggle ? { paddingRight: 40 } : {}),
        ...inputStyle,
      }}
      {...inputProps}
    />
  );

  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && <label style={labelBase()}>{label}</label>}
      {showToggle ? (
        <div style={{ position: 'relative' }}>
          {inputEl}
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
        </div>
      ) : (
        inputEl
      )}
      {hint ? (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}
