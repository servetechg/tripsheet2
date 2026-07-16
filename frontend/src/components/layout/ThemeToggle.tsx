import { G, RADIUS, FONT_UI } from '@/lib/theme';
import { Icons } from '@/components/ui/Icons';

export function ThemeToggle({ mode, onToggle }: any) {
  const isLight = mode === 'light';
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      style={{
        background: G.card2,
        border: `1px solid ${G.border2}`,
        color: G.text,
        borderRadius: RADIUS.pill,
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 700,
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
      <span
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: G.muted,
          textTransform: 'uppercase',
        }}
      >
        {isLight ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
