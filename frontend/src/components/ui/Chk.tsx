import type { InputHTMLAttributes, ReactNode } from 'react';
import { G, RADIUS } from '@/lib/theme';

export interface ChkProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  muted?: boolean;
}

export function Chk({ label, muted, checked, disabled, style, ...p }: ChkProps) {
  return (
    <label
      className="ts-chk"
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <input
          type="checkbox"
          className="ts-chk-input"
          checked={checked}
          disabled={disabled}
          {...p}
        />
        <span
          className="ts-chk-box"
          aria-hidden
          data-checked={checked ? 'true' : 'false'}
          style={{
            width: 18,
            height: 18,
            borderRadius: RADIUS.sm,
            border: `2px solid ${checked ? G.gold : G.border2}`,
            background: checked ? G.gold : G.card,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease',
            boxShadow: checked
              ? 'none'
              : `0 0 0 1px ${G.border} inset`,
          }}
        >
          {checked && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2.5 6.2 5 8.7 9.5 3.8"
                stroke={G.onGold}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </span>
      {label != null && (
        <span
          style={{
            fontSize: 12,
            color: muted ? G.muted : G.text,
            lineHeight: 1.45,
            fontWeight: muted ? 400 : 500,
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
}
