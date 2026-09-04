import { G, RADIUS } from '@/lib/theme';
import { NavIcon } from '@/components/ui/Icons';

export function BottomNav({ tabs, active, onChange }: any) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: G.card,
        borderTop: `1px solid ${G.border}`,
        display: 'flex',
        zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom,0px)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {tabs.map((t: any) => {
        const on = active === t.id;
        const iconColor = on ? G.navActiveText : G.muted;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              flex: '0 0 auto',
              minWidth: 68,
              background: 'none',
              border: 'none',
              padding: '8px 8px 6px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: RADIUS.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: iconColor,
                background: on ? G.navActive : 'transparent',
              }}
            >
              <NavIcon id={t.icon || t.id} size={17} color={iconColor} />
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 0.1,
                color: on ? G.text : G.muted,
                fontWeight: on ? 600 : 400,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
