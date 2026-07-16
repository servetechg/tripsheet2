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
  setToken,
  ApiError,
} from '@/lib/api';
import type { AppUser } from '@/context/AppDataContext';

const THEME_KEY = 'ts_theme';
export const AUTH_EXPIRED_EVENT = 'ts:auth-expired';

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

function toAppUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
}): AppUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    companyId: u.companyId,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readTheme());

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((next: AppUser) => {
    setUser(toAppUser(next));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);

  // Restore session from JWT on first load / refresh
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
        if (!cancelled) setUser(toAppUser(me));
      } catch (e) {
        setToken(null);
        if (!cancelled) setUser(null);
        if (!(e instanceof ApiError && e.status === 401)) {
          // keep bootstrapping false; login will show API errors from AppData
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global 401 from api() → force logout
  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [logout]);

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
