import { G } from '@/lib/theme';

export interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 4 }}>
      {label && (
        <span
          style={{
            fontSize: 11,
            letterSpacing: 0.5,
            color: G.muted,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: G.border }} />
    </div>
  );
}
