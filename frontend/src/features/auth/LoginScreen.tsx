import { useState } from 'react';
import { G, SPACE, RADIUS, FONT_UI, TYPE } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { authApi, setToken, ApiError } from '@/lib/api';
import type { ThemeMode } from '@/lib/theme';
import type { AppUser } from '@/context/AppDataContext';

interface LoginScreenProps {
  onLogin: (user: AppUser) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  apiEnabled: boolean;
  apiError?: string | null;
  onRetryApi?: () => void;
}

export function LoginScreen({
  onLogin,
  themeMode,
  onToggleTheme,
  apiEnabled,
  apiError,
  onRetryApi,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const isDark = themeMode !== 'light';

  const go = async () => {
    setErr('');
    if (!apiEnabled) {
      setErr(apiError || 'API is offline. Start the backend and try again.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), pass.trim());
      setToken(res.accessToken);
      onLogin({
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        companyId: res.user.companyId,
      });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: FONT_UI,
        minHeight: '100vh',
        color: G.text,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        overflow: 'hidden',
        background: isDark
          ? `radial-gradient(ellipse 80% 60% at 50% -10%, ${G.goldBg} 0%, transparent 55%),
             radial-gradient(ellipse 50% 40% at 100% 100%, rgba(30,64,175,0.18) 0%, transparent 50%),
             ${G.bg}`
          : `radial-gradient(ellipse 80% 55% at 50% -5%, ${G.goldBg} 0%, transparent 50%),
             linear-gradient(180deg, ${G.card2} 0%, ${G.bg} 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? `linear-gradient(${G.border} 1px, transparent 1px), linear-gradient(90deg, ${G.border} 1px, transparent 1px)`
            : `linear-gradient(${G.border} 1px, transparent 1px), linear-gradient(90deg, ${G.border} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: isDark ? 0.22 : 0.45,
          pointerEvents: 'none',
          maskImage: 'radial-gradient(ellipse 70% 65% at 50% 40%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 65% at 50% 40%, black 20%, transparent 75%)',
        }}
      />

      <div style={{ position: 'absolute', top: SPACE.xl, right: SPACE.xl, zIndex: 2 }}>
        <ThemeToggle mode={themeMode} onToggle={onToggleTheme} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <BrandLogo variant="full" height={44} style={{ maxWidth: 240 }} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.3,
              color: G.text,
              lineHeight: 1.3,
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              margin: '8px auto 0',
              maxWidth: 320,
              fontSize: 14,
              lineHeight: 1.55,
              color: G.muted,
              fontWeight: 400,
            }}
          >
            Sign in to manage dispatch, tracking, manifests, and trip sheets for your fleet.
          </p>
        </div>

        {!apiEnabled && (
          <div
            style={{
              background: G.dangerBg,
              border: `1px solid ${G.danger}44`,
              borderRadius: RADIUS.lg,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
              color: G.danger,
              lineHeight: 1.45,
            }}
          >
            {apiError || 'Cannot reach the API gateway.'}
            {onRetryApi && (
              <div style={{ marginTop: 10 }}>
                <Btn size="sm" variant="outline" onClick={onRetryApi}>
                  Retry connection
                </Btn>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: G.card,
            border: `1px solid ${G.border}`,
            borderRadius: 18,
            padding: '28px 26px 24px',
            boxShadow: G.shadowHover,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...TYPE.cardTitle, color: G.text, fontWeight: 600 }}>Sign in</div>
            <div style={{ fontSize: 13, color: G.muted, marginTop: 4, lineHeight: 1.4 }}>
              Use your company email and password to continue.
            </div>
          </div>

          <Err msg={err} />
          <Inp
            label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            type="email"
            autoCapitalize="none"
            disabled={!apiEnabled}
          />
          <Inp
            label="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Enter your password"
            type="password"
            onKeyDown={(e) => e.key === 'Enter' && void go()}
            disabled={!apiEnabled}
          />
          <Btn
            full
            size="lg"
            onClick={() => void go()}
            style={{ marginTop: 10 }}
            disabled={loading || !apiEnabled}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Btn>
        </div>

        <p
          style={{
            margin: '20px 0 0',
            textAlign: 'center',
            fontSize: 12,
            color: G.muted,
            lineHeight: 1.5,
          }}
        >
          Secured access for authorized Fleetquix operators only.
        </p>
      </div>
    </div>
  );
}
