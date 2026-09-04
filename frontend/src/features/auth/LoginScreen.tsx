import { useState } from 'react';
import { G, SPACE, RADIUS, FONT_UI, TYPE } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { authApi, setTokens, ApiError, type AuthTokens } from '@/lib/api';
import { PATHS } from '@/lib/paths';
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

type Step =
  | { kind: 'password' }
  | { kind: 'mfa'; mfaToken: string }
  | {
      kind: 'enroll';
      mfaToken: string;
      secret?: string;
      qr?: string;
      recovery?: string[];
    };

function finishSession(
  res: AuthTokens,
  onLogin: (user: AppUser) => void,
) {
  setTokens(res.accessToken, res.refreshToken || null);
  if (res.session) {
    const mins = res.session.idleTimeoutMinutes || 0;
    if (mins > 0) sessionStorage.setItem('ts_idle_minutes', String(mins));
    else sessionStorage.removeItem('ts_idle_minutes');
  }
  onLogin({
    id: res.user.id,
    name: res.user.name,
    email: res.user.email,
    role: res.user.role,
    companyId: res.user.companyId,
    tenantKey: res.user.tenantKey ?? null,
    permissions: res.user.permissions ?? [],
    customRoleId: res.user.customRoleId ?? null,
    customRoleName: res.user.customRoleName ?? null,
  });
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
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const goPassword = async () => {
    setErr('');
    if (!apiEnabled) {
      setErr(apiError || 'API is offline. Start the backend and try again.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), pass.trim());
      if ('mfaRequired' in res && res.mfaRequired) {
        setStep({ kind: 'mfa', mfaToken: res.mfaToken });
        setCode('');
        return;
      }
      if ('mfaEnrollmentRequired' in res && res.mfaEnrollmentRequired) {
        const started = await authApi.mfaEnrollLoginStart(res.mfaToken);
        setStep({
          kind: 'enroll',
          mfaToken: started.mfaToken,
          secret: started.secret,
          qr: started.qrCodeDataUrl,
        });
        setCode('');
        return;
      }
      if ('accessToken' in res) {
        finishSession(res, onLogin);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const goMfa = async () => {
    if (step.kind !== 'mfa') return;
    setErr('');
    setLoading(true);
    try {
      const res = await authApi.mfaChallenge(step.mfaToken, code.trim());
      finishSession(res, onLogin);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const goEnrollConfirm = async () => {
    if (step.kind !== 'enroll') return;
    setErr('');
    setLoading(true);
    try {
      const res = await authApi.mfaEnrollLoginConfirm(
        step.mfaToken,
        code.trim(),
      );
      if (res.recoveryCodes?.length) {
        setStep({
          ...step,
          recovery: res.recoveryCodes,
        });
        setTokens(res.accessToken, res.refreshToken || null);
        return;
      }
      finishSession(res, onLogin);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not enable MFA');
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
        background: G.bg,
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle mode={themeMode} onToggle={onToggleTheme} />
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: G.card,
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.lg,
          padding: SPACE.xl,
          boxShadow: G.shadow,
        }}
      >
        <BrandLogo />
        <h1 style={{ ...TYPE.sectionTitle, margin: '20px 0 8px' }}>
          {step.kind === 'password'
            ? 'Sign in'
            : step.kind === 'mfa'
              ? 'Authenticator code'
              : step.recovery
                ? 'Save recovery codes'
                : 'Set up MFA'}
        </h1>
        <p style={{ color: G.muted, fontSize: 13, marginBottom: 20 }}>
          {step.kind === 'password'
            ? 'Email and password to continue.'
            : step.kind === 'mfa'
              ? 'Enter the 6-digit code from your authenticator app, or a recovery code.'
              : step.recovery
                ? 'Store these codes safely. You will need them if you lose your authenticator.'
                : 'Your company requires MFA. Scan the QR code, then enter a code to finish.'}
        </p>
        {err ? <Err msg={err} /> : null}

        {step.kind === 'password' && (
          <>
            <Inp
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Inp
              label="Password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void goPassword()}
            />
            <Btn
              full
              onClick={() => void goPassword()}
              disabled={loading || !email.trim() || !pass.trim()}
            >
              {loading ? 'Signing in…' : 'Continue'}
            </Btn>
            <p style={{ marginTop: 16, fontSize: 13 }}>
              <a href={PATHS.forgotPassword} style={{ color: G.gold }}>
                Forgot password?
              </a>
            </p>
          </>
        )}

        {step.kind === 'mfa' && (
          <>
            <Inp
              label="Authenticator or recovery code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void goMfa()}
            />
            <Btn
              full
              onClick={() => void goMfa()}
              disabled={loading || code.trim().length < 4}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </Btn>
            <Btn
              full
              variant="ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                setStep({ kind: 'password' });
                setCode('');
                setErr('');
              }}
            >
              Back
            </Btn>
          </>
        )}

        {step.kind === 'enroll' && !step.recovery && (
          <>
            {step.qr ? (
              <img
                src={step.qr}
                alt="MFA QR code"
                style={{
                  display: 'block',
                  margin: '0 auto 12px',
                  borderRadius: 8,
                  background: '#fff',
                }}
              />
            ) : null}
            {step.secret ? (
              <div
                style={{
                  fontSize: 12,
                  color: G.muted,
                  wordBreak: 'break-all',
                  marginBottom: 12,
                }}
              >
                Manual key: <code>{step.secret}</code>
              </div>
            ) : null}
            <Inp
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void goEnrollConfirm()}
            />
            <Btn
              full
              onClick={() => void goEnrollConfirm()}
              disabled={loading || code.trim().length < 6}
            >
              {loading ? 'Enabling…' : 'Enable MFA & sign in'}
            </Btn>
          </>
        )}

        {step.kind === 'enroll' && step.recovery && (
          <>
            <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 16 }}>
              {step.recovery.map((c) => (
                <li key={c} style={{ fontFamily: 'monospace' }}>
                  {c}
                </li>
              ))}
            </ul>
            <Btn
              full
              onClick={() => {
                const token = localStorage.getItem('ts_token');
                if (!token) {
                  setErr('Session missing — sign in again');
                  setStep({ kind: 'password' });
                  return;
                }
                void authApi.me().then((me) => {
                  onLogin({
                    id: me.id,
                    name: me.name,
                    email: me.email,
                    role: me.role,
                    companyId: me.companyId,
                    tenantKey: me.tenantKey ?? null,
                    permissions: me.permissions ?? [],
                    customRoleId: me.customRoleId ?? null,
                    customRoleName: me.customRoleName ?? null,
                  });
                });
              }}
            >
              I saved my codes — continue
            </Btn>
          </>
        )}

        {!apiEnabled && onRetryApi ? (
          <Btn
            full
            variant="ghost"
            style={{ marginTop: 12 }}
            onClick={() => onRetryApi()}
          >
            Retry API
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
