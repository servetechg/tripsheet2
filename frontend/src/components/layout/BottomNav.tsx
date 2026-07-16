import { G } from '@/lib/theme';
import { NavIcon } from '@/components/ui/Icons';

export function BottomNav({ tabs, active, onChange }: any) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background:
          G.mode === 'light'
            ? 'rgba(255,255,255,0.94)'
            : 'rgba(17,24,39,0.94)',
        borderTop: `1px solid ${G.border}`,
        display: 'flex',
        zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom,0px)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 -4px 16px rgba(15,23,42,0.06)',
      }}
    >
      {tabs.map((t: any) => {
        const on = active === t.id;
        const color = on ? G.gold : G.muted;
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
              padding: '10px 8px 8px',
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
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
              }}
            >
              <NavIcon id={t.icon || t.id} size={20} color={color} />
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 0.2,
                color,
                fontWeight: on ? 600 : 500,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </span>
            {on && (
              <div
                style={{
                  width: 18,
                  height: 2.5,
                  background: G.gold,
                  borderRadius: 99,
                  marginTop: 1,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
