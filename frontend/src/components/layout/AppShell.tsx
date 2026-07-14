import type { ReactNode } from 'react';
import { G, SPACE, page } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { ThemeToggle } from './ThemeToggle';
import type { NavTab } from '@/types/app';

interface AppShellProps {
  logo: string;
  subtitle: string;
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  topRight?: ReactNode;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  children?: ReactNode;
}

export function AppShell({ logo, subtitle, tabs, activeTab, onTabChange, topRight, themeMode, onToggleTheme, children }: AppShellProps) {
  const w = useMediaQuery();
  const mob = w < 768;
  return (
    <div style={{ ...page() }}>
      {!mob && <SideNav tabs={tabs} active={activeTab} onChange={onTabChange} logo={logo} subtitle={subtitle} />}
      {/* Top bar */}
      <div style={{ position:"sticky", top:0, zIndex:200, background:G.card, borderBottom:`1px solid ${G.border}`, padding: mob ? "13px 16px" : "13px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", marginLeft: mob ? 0 : 224, backdropFilter:"blur(8px)" }}>
        {mob ? (
          <div style={{ fontSize:19, fontWeight:900, letterSpacing:-1, color:G.text }}>{logo.slice(0,-1)}<span style={{ color:G.gold }}>{logo.slice(-1)}</span></div>
        ) : (
          <div style={{ fontSize:10, letterSpacing:3, color:G.muted2, fontWeight:700, textTransform:"uppercase" }}>{tabs.find(t=>t.id===activeTab)?.label}</div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:SPACE.sm }}>
          {onToggleTheme && <ThemeToggle mode={themeMode} onToggle={onToggleTheme} />}
          {topRight}
        </div>
      </div>
      {/* Page content */}
      <div style={{ marginLeft: mob ? 0 : 224, padding: mob ? "14px 13px 90px" : "22px 26px 40px", maxWidth: mob ? "100%" : 1080, boxSizing:"border-box" }}>
        {children}
      </div>
      {mob && <BottomNav tabs={tabs} active={activeTab} onChange={onTabChange} />}
    </div>
  );
}
