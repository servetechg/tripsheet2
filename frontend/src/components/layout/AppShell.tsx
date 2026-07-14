import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { G, SPACE, RADIUS, SHADOW, SHELL, page } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Icons } from '@/components/ui/Icons';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import type { NavTab } from '@/types/app';

interface AppShellProps {
  logo: string;
  subtitle: string;
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** @deprecated Prefer onLogout — kept for compatibility */
  topRight?: ReactNode;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  children?: ReactNode;
  userName?: string;
  userRole?: string;
  pageTitle?: string;
}

function formatNow(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AppShell({
  logo,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  themeMode,
  onToggleTheme,
  onLogout,
  children,
  userName,
  userRole,
  pageTitle,
}: AppShellProps) {
  const w = useMediaQuery();
  const mob = w < 768;
  const [now, setNow] = useState(() => formatNow(new Date()));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLabel =
    pageTitle || tabs.find((t) => t.id === activeTab)?.label || 'Dashboard';
  const isLight = themeMode !== 'dark';

  useEffect(() => {
    const id = window.setInterval(() => setNow(formatNow(new Date())), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initials = (userName || subtitle || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const menuItemStyle = {
    width: '100%' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: RADIUS.sm,
    cursor: 'pointer',
    color: G.text,
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'left' as const,
    fontFamily: 'inherit',
  };

  return (
    <div style={{ ...page() }}>
      {!mob && (
        <SideNav
          tabs={tabs}
          active={activeTab}
          onChange={onTabChange}
          logo={logo}
          subtitle={subtitle}
        />
      )}

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          height: mob ? 'auto' : SHELL.headerHeight,
          minHeight: SHELL.headerHeight,
          boxSizing: 'border-box',
          background: G.mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(17,24,39,0.92)',
          borderBottom: `1px solid ${G.border}`,
          padding: mob ? '12px 16px' : `0 ${SHELL.headerPadX + 4}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginLeft: mob ? 0 : SHELL.navWidth,
          backdropFilter: 'blur(12px)',
          boxShadow: SHADOW.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {mob && (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${G.primary}, ${G.secondary})`,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {logo.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontSize: mob ? 18 : 20,
                fontWeight: 700,
                letterSpacing: -0.3,
                color: G.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeLabel}
            </div>
            <div style={{ fontSize: 12, color: G.muted, marginTop: 3 }}>{now}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexShrink: 0 }}>
          <button
            type="button"
            title="Notifications"
            className="ts-btn"
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              border: `1px solid ${G.border}`,
              background: G.card,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              color: G.muted2,
            }}
          >
            {Icons.notifications({ size: 20 })}
            <span
              style={{
                position: 'absolute',
                top: 8,
                right: 9,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: G.danger,
                border: `1.5px solid ${G.card}`,
              }}
            />
          </button>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="ts-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: mob ? 4 : '4px 10px 4px 4px',
                borderRadius: RADIUS.pill,
                border: `1px solid ${menuOpen ? G.primary + '55' : G.border}`,
                background: G.card,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: G.primaryBg,
                  color: G.primary,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {initials}
              </div>
              {!mob && (
                <div style={{ lineHeight: 1.2, paddingRight: 2, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                    {userName || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    {userRole || subtitle}
                  </div>
                </div>
              )}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={G.muted}
                style={{
                  marginRight: 2,
                  transform: menuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .15s',
                }}
                aria-hidden
              >
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  minWidth: 200,
                  background: G.card,
                  border: `1px solid ${G.border}`,
                  borderRadius: RADIUS.lg,
                  boxShadow: SHADOW.lg,
                  padding: 6,
                  zIndex: 400,
                }}
              >
                <div
                  style={{
                    padding: '10px 12px 8px',
                    borderBottom: `1px solid ${G.border}`,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                    {userName || 'User'}
                  </div>
                  <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                    {userRole || subtitle}
                  </div>
                </div>

                {onToggleTheme && (
                  <button
                    type="button"
                    role="menuitem"
                    style={menuItemStyle}
                    onClick={() => {
                      onToggleTheme();
                    }}
                  >
                    <span style={{ color: G.muted, width: 18, display: 'inline-flex' }}>
                      {isLight
                        ? Icons.darkMode({ size: 18 })
                        : Icons.lightMode({ size: 18 })}
                    </span>
                    {isLight ? 'Dark mode' : 'Light mode'}
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    role="menuitem"
                    style={{ ...menuItemStyle, color: G.danger }}
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <span style={{ width: 18, display: 'inline-flex', color: G.danger }}>
                      {Icons.logout({ size: 18, color: G.danger })}
                    </span>
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          marginLeft: mob ? 0 : SHELL.navWidth,
          padding: mob ? '16px 14px 96px' : '24px 28px 48px',
          width: mob ? '100%' : `calc(100% - ${SHELL.navWidth}px)`,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>

      {mob && <BottomNav tabs={tabs} active={activeTab} onChange={onTabChange} />}
    </div>
  );
}
