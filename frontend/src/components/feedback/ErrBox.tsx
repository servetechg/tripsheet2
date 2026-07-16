import { G } from '@/lib/theme';
import { Icons } from '@/components/ui/Icons';

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
      {Icons.alert({ size: 16, color: G.danger })}
      <span>{msg}</span>
    </div>
  );
}
