import { G } from '@/lib/theme';

export function BottomNav({ tabs, active, onChange }: any) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: G.card,
        borderTop: `1px solid ${G.border}`,
        display: 'flex',
        zIndex: 500,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)',
      }}
    >
      {tabs.map((t: any) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="ts-nav-item"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: '10px 2px 8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? G.primary : G.muted,
              }}
            >
              {t.icon}
            </span>
            <span
              style={{
                fontSize: 10,
                color: isActive ? G.primary : G.muted,
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1.2,
              }}
            >
              {t.label}
            </span>
            {isActive && (
              <div
                style={{
                  width: 18,
                  height: 3,
                  background: G.primary,
                  borderRadius: 3,
                  marginTop: 1,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
