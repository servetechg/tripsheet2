import { G, RADIUS, SHADOW, FONT_UI, SHELL } from '@/lib/theme';

export function SideNav({ tabs, active, onChange, logo, subtitle }: any) {
  return (
    <aside
      style={{
        width: SHELL.navWidth,
        minWidth: SHELL.navWidth,
        background: G.card,
        borderRight: `1px solid ${G.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 300,
        boxShadow: SHADOW.sm,
        fontFamily: FONT_UI,
      }}
    >
      <div
        style={{
          height: SHELL.headerHeight,
          minHeight: SHELL.headerHeight,
          maxHeight: SHELL.headerHeight,
          padding: `0 ${SHELL.headerPadX}px`,
          borderBottom: `1px solid ${G.border}`,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(145deg, ${G.primary}, ${G.secondary})`,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: -0.5,
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.28)',
              flexShrink: 0,
            }}
          >
            {String(logo || 'TS').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: G.text,
                letterSpacing: -0.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {logo}
            </div>
            <div
              style={{
                fontSize: 12,
                color: G.muted,
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: G.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            padding: '4px 10px 10px',
          }}
        >
          Menu
        </div>
        {tabs.map((t: any) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className="ts-nav-item"
              onClick={() => onChange(t.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 12px',
                background: isActive ? G.primaryBg : 'transparent',
                border: isActive ? `1px solid ${G.primary}22` : '1px solid transparent',
                borderRadius: RADIUS.md,
                cursor: 'pointer',
                marginBottom: 4,
                textAlign: 'left',
                position: 'relative',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 10,
                    bottom: 10,
                    width: 3,
                    borderRadius: 4,
                    background: G.primary,
                  }}
                />
              )}
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
                  fontSize: 13,
                  color: isActive ? G.primary : G.muted2,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div
        style={{
          padding: '14px 16px 18px',
          borderTop: `1px solid ${G.border}`,
          fontSize: 11,
          color: G.muted,
        }}
      >
        TripSheet · Enterprise
      </div>
    </aside>
  );
}
