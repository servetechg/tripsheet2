import { G } from '@/lib/theme';

export interface ErrBoxProps {
  msg?: string | null;
}

export function ErrBox({ msg }: ErrBoxProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: G.dangerBg,
        border: `1px solid ${G.danger}33`,
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 12,
        color: G.danger,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>⚠️</span>
      <span>{msg}</span>
    </div>
  );
}
