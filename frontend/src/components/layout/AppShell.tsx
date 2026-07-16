import type { ReactNode } from 'react';
import { G, SPACE, page } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from './shellLayout';
import type { NavTab } from '@/types/app';

interface AppShellProps {
  logo: string;
  subtitle: string;
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  topRight?: ReactNode;
  userName?: string;
  userEmail?: string;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  showNotifications?: boolean;
  children?: ReactNode;
}

export function AppShell({
  logo,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  topRight,
  userName,
  userEmail,
  themeMode,
  onToggleTheme,
  onLogout,
  showNotifications = true,
  children,
}: AppShellProps) {
  const w = useMediaQuery();
  const mob = w < 768;
  const wide = activeTab === 'dashboard';
  const showUserMenu = !!(onLogout || onToggleTheme);

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
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          boxSizing: 'border-box',
          background:
            G.mode === 'light'
              ? 'rgba(255,255,255,0.92)'
              : 'rgba(17,24,39,0.92)',
          borderBottom: `1px solid ${G.border}`,
          padding: mob ? '0 16px' : '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginLeft: mob ? 0 : SIDEBAR_WIDTH,
          backdropFilter: 'blur(12px)',
        }}
      >
        {mob ? (
          <BrandLogo variant="full" height={26} style={{ maxWidth: 140 }} />
        ) : (
          <div
            style={{
              fontSize: 15,
              letterSpacing: -0.1,
              color: G.text,
              fontWeight: 600,
            }}
          >
            {tabs.find((t) => t.id === activeTab)?.label}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          {topRight}
          {showNotifications && <NotificationBell />}
          {showUserMenu && (
            <UserMenu
              name={userName}
              email={userEmail}
              companyLabel={logo}
              themeMode={themeMode}
              onToggleTheme={onToggleTheme}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
      <div
        style={{
          marginLeft: mob ? 0 : SIDEBAR_WIDTH,
          padding: mob
            ? '14px 13px 90px'
            : wide
              ? '24px 28px 48px'
              : '22px 28px 40px',
          maxWidth: mob ? '100%' : wide ? 1360 : 1120,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
      {mob && (
        <BottomNav tabs={tabs} active={activeTab} onChange={onTabChange} />
      )}
    </div>
  );
}
