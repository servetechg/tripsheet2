import { G, RADIUS } from '@/lib/theme';
import { NavIcon } from '@/components/ui/Icons';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from './shellLayout';

export function SideNav({ tabs, active, onChange, logo, subtitle }: any) {
  return (
    <div
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        background: G.card,
        borderRight: `1px solid ${G.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 300,
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          padding: '0 16px',
          borderBottom: `1px solid ${G.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxSizing: 'border-box',
        }}
      >
        <BrandLogo variant="full" height={28} style={{ maxWidth: 148 }} />
        {/* {subtitle && (
          <div
            style={{
              fontSize: 9,
              letterSpacing: 0.8,
              color: G.muted,
              textTransform: 'uppercase',
              fontWeight: 600,
              borderLeft: `1px solid ${G.border}`,
              paddingLeft: 10,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
            title={logo}
          >
            {subtitle}
          </div>
        )} */}
      </div>
      <div style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {tabs.map((t: any) => {
          const on = active === t.id;
          const color = on ? G.gold : G.muted;
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
                gap: 12,
                padding: '11px 12px',
                background: on ? G.goldBg : 'transparent',
                border: on ? `1px solid ${G.gold}33` : '1px solid transparent',
                borderRadius: RADIUS.md,
                cursor: 'pointer',
                marginBottom: 4,
                textAlign: 'left',
                transition:
                  'background .15s ease, border-color .15s ease, color .15s ease',
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
                  flexShrink: 0,
                }}
              >
                <NavIcon id={t.icon || t.id} size={20} color={color} />
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: on ? G.gold : G.muted2,
                  fontWeight: on ? 600 : 500,
                  letterSpacing: 0.1,
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
