import { G, RADIUS, FONT_UI } from '@/lib/theme';

export function ThemeToggle({ mode, onToggle }: any) {
  const isLight = mode === 'light';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="ts-btn"
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        color: G.text,
        borderRadius: RADIUS.md,
        width: 40,
        height: 40,
        padding: 0,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        fontFamily: FONT_UI,
      }}
    >
      {isLight ? '☾' : '☀'}
    </button>
  );
}
