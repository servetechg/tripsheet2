import { useId, type CSSProperties, type SelectHTMLAttributes, type ReactNode } from 'react';
import { G, inputBase, labelBase } from '@/lib/theme';
import { Icons } from './Icons';

export interface SelProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  style?: CSSProperties;
  children?: ReactNode;
  /** Compact inline select for toolbars / card actions (no label spacing). */
  compact?: boolean;
}

export function Sel({ label, children, style: sx, id, compact, ...p }: SelProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div style={{ marginBottom: compact ? 0 : 12, ...sx }}>
      {label ? (
        <label htmlFor={selectId} style={labelBase()}>
          {label}
        </label>
      ) : null}
      <div style={{ position: 'relative', display: compact ? 'inline-block' : 'block' }}>
        <select
          id={selectId}
          className="ts-input ts-select"
          style={{
            ...inputBase(),
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            cursor: 'pointer',
            ...(compact
              ? {
                  width: 'auto',
                  minWidth: 132,
                  minHeight: 32,
                  padding: '6px 32px 6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }
              : {
                  paddingRight: 36,
                  width: '100%',
                }),
          }}
          {...p}
        >
          {children}
        </select>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: G.muted,
          }}
        >
          {Icons.chevronDown({ size: 16, color: G.muted })}
        </span>
      </div>
    </div>
  );
}
