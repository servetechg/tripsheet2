import { G, RADIUS } from '@/lib/theme';
import { NavIcon } from '@/components/ui/Icons';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  HEADER_HEIGHT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_COLLAPSED,
} from './shellLayout';

type SideNavProps = {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  active: string;
  onChange: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function SideNav({
  tabs,
  active,
  onChange,
  collapsed,
  onToggleCollapse,
}: SideNavProps) {
  const isDark = G.mode === 'dark';
  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <div
      style={{
        width,
        minWidth: width,
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
        transition: 'width .2s ease, min-width .2s ease',
      }}
    >
      <div
        style={{
          padding: collapsed ? '18px 8px 16px' : '18px 14px 16px 20px',
          borderBottom: isDark
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : `1px solid ${G.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: collapsed ? 4 : 12,
          flexShrink: 0,
          minHeight: HEADER_HEIGHT,
          boxSizing: 'border-box',
        }}
      >
        {!collapsed && (
          <BrandLogo
            variant="full"
            height={24}
            style={{ maxWidth: 140, flexShrink: 0 }}
          />
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: collapsed ? 28 : 32,
            height: collapsed ? 28 : 32,
            padding: collapsed ? 6 : 8,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            background: 'transparent',
            color: G.muted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M4 12h11" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </div>

      <div
        className="ts-sidebar-nav"
        style={{
          flex: 1,
          minHeight: 0,
          padding: collapsed ? '10px 8px' : '10px 10px',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {tabs.map((t) => {
          const on = active === t.id;
          const iconColor = on ? G.navActiveText : G.muted;
          const labelColor = on ? G.navActiveText : G.muted;

          return (
            <button
              key={t.id}
              type="button"
              title={collapsed ? t.label : undefined}
              className={on ? 'ts-nav-item ts-nav-item-active' : 'ts-nav-item'}
              onClick={() => onChange(t.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 12,
                padding: collapsed ? '11px 0' : '10px 14px',
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
              {!collapsed ? (
                <span
                  style={{
                    fontSize: 15,
                    color: labelColor,
                    fontWeight: on ? 600 : 500,
                    letterSpacing: 0,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

    </div>
  );
}
