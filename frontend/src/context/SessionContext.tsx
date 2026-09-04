import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeMode } from '@/lib/theme';
import { applyTheme } from '@/lib/theme';
import {
  authApi,
  getToken,
  clearTokens,
  getRefreshToken,
  ApiError,
} from '@/lib/api';
import type { AppUser } from '@/context/AppDataContext';

const THEME_KEY = 'ts_theme';
export const AUTH_EXPIRED_EVENT = 'ts:auth-expired';
const IDLE_KEY = 'ts_idle_minutes';

function rememberIdle(minutes?: number) {
  const n = Number(minutes || 0);
  if (n > 0) sessionStorage.setItem(IDLE_KEY, String(n));
  else sessionStorage.removeItem(IDLE_KEY);
}

type SessionContextValue = {
  user: AppUser | null;
  bootstrapping: boolean;
  themeMode: ThemeMode;
  login: (user: AppUser) => void;
  logout: () => void;
  toggleTheme: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function readTheme(): ThemeMode {
  const raw = localStorage.getItem(THEME_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'dark';
}

function commitTheme(mode: ThemeMode) {
  applyTheme(mode);
  localStorage.setItem(THEME_KEY, mode);
}

function toAppUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  tenantKey?: string | null;
  permissions?: string[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  driverId?: string | null;
}): AppUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.companyId,
    tenantKey: u.tenantKey ?? null,
    permissions: u.permissions ?? [],
    customRoleId: u.customRoleId ?? null,
    customRoleName: u.customRoleName ?? null,
    driverRecordId: u.driverId ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const mode = readTheme();
    commitTheme(mode);
    return mode;
  });

  const login = useCallback((next: AppUser) => {
    setUser(toAppUser(next));
  }, []);

  const logout = useCallback(() => {
    const refresh = getRefreshToken();
    if (getToken()) {
      void authApi.logout(refresh || undefined).catch(() => undefined);
    }
    clearTokens();
    setUser(null);
    sessionStorage.removeItem(IDLE_KEY);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode((m) => {
      const next: ThemeMode = m === 'dark' ? 'light' : 'dark';
      commitTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setBootstrapping(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(toAppUser(me));
          rememberIdle(me.session?.idleTimeoutMinutes);
        }
      } catch (e) {
        clearTokens();
        if (!cancelled) setUser(null);
        if (!(e instanceof ApiError && e.status === 401)) {
          // swallow non-401 during bootstrap
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clearTokens();
      setUser(null);
      sessionStorage.removeItem(IDLE_KEY);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (!user) return;
    const mins = Number(sessionStorage.getItem(IDLE_KEY) || 0);
    if (mins <= 0) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const evts: Array<keyof WindowEventMap> = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    for (const e of evts) window.addEventListener(e, bump, { passive: true });
    const timer = window.setInterval(() => {
      if (Date.now() - last > mins * 60_000) logout();
    }, 15_000);
    return () => {
      window.clearInterval(timer);
      for (const e of evts) window.removeEventListener(e, bump);
    };
  }, [user, logout]);

  const value = useMemo(
    () => ({
      user,
      bootstrapping,
      themeMode,
      login,
      logout,
      toggleTheme,
    }),
    [user, bootstrapping, themeMode, login, logout, toggleTheme],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
