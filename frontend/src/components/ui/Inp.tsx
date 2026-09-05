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
  PHONE_PLACEHOLDER,
  resolveInputPlaceholder,
  resolveInputType,
} from '@/lib/inputPlaceholders';
import { Icons } from './Icons';
import { DatePickerInput, type DatePickerMode } from './DatePickerInput';

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

export function Inp({
  label,
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
  value,
  min,
  max,
  disabled,
  ...p
}: InpProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [showPassword, setShowPassword] = useState(false);
  const resolvedInputType = resolveInputType(type, label, phone);
  const isPassword = resolvedInputType === 'password';
  const isPicker =
    resolvedInputType === 'date' ||
    resolvedInputType === 'time' ||
    resolvedInputType === 'datetime-local';
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

  if (isPicker) {
    const pickerMode: DatePickerMode =
      resolvedInputType === 'datetime-local'
        ? 'datetime'
        : resolvedInputType === 'time'
          ? 'time'
          : 'date';
    return (
      <div style={{ marginBottom: 12, ...sx }}>
        {label ? (
          <label htmlFor={inputId} style={labelBase()}>
            {label}
          </label>
        ) : null}
        <DatePickerInput
          id={inputId}
          mode={pickerMode}
          value={value != null ? String(value) : ''}
          onChange={onChange}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          min={min != null ? String(min) : undefined}
          max={max != null ? String(max) : undefined}
          style={inputStyle}
        />
        {hint ? (
          <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{hint}</div>
        ) : null}
      </div>
    );
  }

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {
    ...p,
    id: inputId,
    type: resolvedType,
    placeholder: resolvedPlaceholder,
    onChange: handleChange,
    maxLength: phone ? PHONE_INPUT_MAX_LENGTH : maxLength,
    value,
    min,
    max,
    disabled,
    ...(phone
      ? { inputMode: 'tel', autoComplete: p.autoComplete ?? 'tel' }
      : {}),
  };

  const inputEl = (
    <input
      className="ts-input"
      style={{
        ...inputBase(),
        ...(showToggle ? { paddingRight: 44 } : {}),
        ...inputStyle,
      }}
      {...inputProps}
    />
  );

  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label ? (
        <label htmlFor={inputId} style={labelBase()}>
          {label}
        </label>
      ) : null}
      {showToggle ? (
        <div style={{ position: 'relative' }}>
          {inputEl}
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
