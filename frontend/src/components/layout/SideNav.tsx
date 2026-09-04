import { G, RADIUS } from '@/lib/theme';
import { NavIcon } from '@/components/ui/Icons';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from './shellLayout';

export function SideNav({ tabs, active, onChange }: any) {
  const isDark = G.mode === 'dark';

  return (
    <div
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        background: G.sidebar,
        borderRight: isDark
          ? '1px solid rgba(255, 255, 255, 0.06)'
          : `1px solid ${G.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxHeight: '100dvh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 300,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '18px 20px 16px',
          borderBottom: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : `1px solid ${G.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexShrink: 0,
          minHeight: HEADER_HEIGHT,
          boxSizing: 'border-box',
        }}
      >
        <BrandLogo variant="full" height={24} style={{ maxWidth: 140 }} />
      </div>

      <div
        className="ts-sidebar-nav"
        style={{
          flex: 1,
          minHeight: 0,
          padding: '10px 10px',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {tabs.map((t: any) => {
          const on = active === t.id;
          const iconColor = on ? G.navActiveText : G.muted;
          const labelColor = on ? G.navActiveText : G.muted;

          return (
            <button
              key={t.id}
              type="button"
              className={on ? 'ts-nav-item ts-nav-item-active' : 'ts-nav-item'}
              onClick={() => onChange(t.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: on ? G.navActive : 'transparent',
                border: 'none',
                borderRadius: RADIUS.md,
                cursor: 'pointer',
                marginBottom: 2,
                textAlign: 'left',
                transition: 'background .15s ease, color .15s ease',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: iconColor,
                  flexShrink: 0,
                  opacity: on ? 1 : 0.85,
                }}
              >
                <NavIcon id={t.icon || t.id} size={19} color={iconColor} />
              </span>
              <span
                style={{
                  fontSize: 15,
                  color: labelColor,
                  fontWeight: on ? 600 : 500,
                  letterSpacing: 0,
                  lineHeight: 1.3,
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
