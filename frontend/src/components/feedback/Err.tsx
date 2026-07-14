import { G } from '@/lib/theme';

export interface ErrProps {
  msg?: string | null;
}

export function Err({ msg }: ErrProps) {
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
        gap: 8,
        alignItems: 'center',
      }}
    >
      ⚠️ {msg}
    </div>
  );
}
