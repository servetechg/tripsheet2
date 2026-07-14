import { G } from '@/lib/theme';

export interface OkBoxProps {
  msg?: string | null;
}

export function OkBox({ msg }: OkBoxProps) {
  if (!msg) return null;
  return (
    <div
      style={{
        background: G.successBg,
        border: `1px solid ${G.success}33`,
        borderRadius: 9,
        padding: '11px 14px',
        fontSize: 12,
        color: G.success,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>✓</span>
      <span>{msg}</span>
    </div>
  );
}
