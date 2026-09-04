import { G, RADIUS, FONT_UI } from '@/lib/theme';
import { Icons } from '@/components/ui/Icons';

export function ThemeToggle({ mode, onToggle }: any) {
  const isLight = mode === 'light';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="ts-icon-btn"
      style={{
        background: G.card2,
        border: `1px solid ${G.border}`,
        color: G.text,
        borderRadius: RADIUS.md,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: FONT_UI,
      }}
    >
      {isLight
        ? Icons.sun({ size: 14, color: G.gold })
        : Icons.moon({ size: 14, color: G.muted2 })}
      <span style={{ fontSize: 12, color: G.muted2 }}>
        {isLight ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
