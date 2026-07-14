import { useState } from 'react';
import { G, SPACE, pageCentered } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
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
    <div style={{ ...pageCentered(), position: 'relative' }}>
      <div style={{ position: 'absolute', top: SPACE.xl, right: SPACE.xl }}>
        <ThemeToggle mode={themeMode} onToggle={onToggleTheme} />
      </div>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: -3,
              color: G.text,
              lineHeight: 1,
            }}
          >
            TRIP<span style={{ color: G.gold }}>SHEET</span>
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 5,
              color: G.muted,
              marginTop: 8,
              textTransform: 'uppercase',
            }}
          >
            Fleet Management Portal
          </div>
          <div
            style={{
              fontSize: 10,
              color: apiEnabled ? G.success : G.danger,
              marginTop: 8,
            }}
          >
            {apiEnabled ? '● Live API' : '○ API offline'}
          </div>
        </div>

        {!apiEnabled && (
          <div
            style={{
              background: G.dangerBg,
              border: `1px solid ${G.danger}44`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              fontSize: 12,
              color: G.danger,
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
            borderRadius: 16,
            padding: '28px 24px',
          }}
        >
          <Err msg={err} />
          <Inp
            label="Email Address"
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
            placeholder="••••••••"
            type="password"
            onKeyDown={(e) => e.key === 'Enter' && void go()}
            disabled={!apiEnabled}
          />
          <Btn
            full
            size="lg"
            onClick={() => void go()}
            style={{ marginTop: 8 }}
            disabled={loading || !apiEnabled}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN →'}
          </Btn>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 3,
              color: G.muted,
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            DEMO ACCOUNTS — TAP TO FILL
          </div>
          {[
            {
              role: '⚡ Super Admin',
              email: 'admin@tripsheet.io',
              pass: 'admin123',
              color: G.gold,
            },
            {
              role: '🏢 Company Admin',
              email: 'admin@mkx.ca',
              pass: 'mkx123',
              color: G.info,
            },
            {
              role: '🚛 Driver',
              email: 'divyam@mkx.ca',
              pass: 'driver123',
              color: G.success,
            },
          ].map((a) => (
            <div
              key={a.role}
              onClick={() => {
                setEmail(a.email);
                setPass(a.pass);
                setErr('');
              }}
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: 10,
                padding: '11px 14px',
                marginBottom: 7,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: apiEnabled ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 12, color: a.color, fontWeight: 700 }}>
                {a.role}
              </span>
              <span style={{ fontSize: 10, color: G.muted }}>{a.email}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
