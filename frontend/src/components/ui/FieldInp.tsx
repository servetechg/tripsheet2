import {
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';
import { formatPhoneInput, PHONE_INPUT_MAX_LENGTH } from '@/lib/phoneFormat';
import {
  resolveInputPlaceholder,
  resolveInputType,
} from '@/lib/inputPlaceholders';
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

const passwordToggleBtnStyle: CSSProperties = {
  position: 'absolute',
  right: 4,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  zIndex: 2,
  lineHeight: 0,
};

/** Styled input with optional inline error (extends Inp pattern). */
export function FieldInp({
  label,
  error,
  hint,
  style: sx,
  inputStyle,
  phone,
  passwordToggle,
  type,
  id,
  onChange,
  maxLength,
  placeholder,
  ...p
}: FieldInpProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [showPassword, setShowPassword] = useState(false);
  const resolvedInputType = resolveInputType(type, label, phone);
  const isPassword = resolvedInputType === 'password';
  const showToggle = isPassword && passwordToggle !== false;
  const resolvedType =
    isPassword && showToggle && showPassword ? 'text' : resolvedInputType;

  const resolvedPlaceholder = resolveInputPlaceholder(placeholder, label, {
    phone,
    isPassword,
  });

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
      {label ? (
        <label htmlFor={inputId} style={labelBase()}>
          {label}
        </label>
      ) : null}
      <div style={{ position: 'relative' }}>
        <input
          className="ts-input"
          id={inputId}
          style={{
            ...inputBase(),
            borderColor: error ? G.danger : G.border,
            boxShadow: error ? `0 0 0 3px ${G.danger}22` : undefined,
            ...(showToggle ? { paddingRight: 44 } : {}),
            ...inputStyle,
          }}
          type={resolvedType}
          placeholder={resolvedPlaceholder}
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
            style={{ ...passwordToggleBtnStyle, color: G.muted }}
          >
            {showPassword
              ? Icons.eyeOff({ size: 18, color: G.muted })
              : Icons.eye({ size: 18, color: G.muted })}
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
