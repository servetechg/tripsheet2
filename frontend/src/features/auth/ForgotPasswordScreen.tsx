import { useState } from 'react';
import { Link } from 'react-router-dom';
import { G, FONT_UI } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { authApi, ApiError } from '@/lib/api';

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setErr('');
    setMsg('');
    setResetUrl('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setMsg(res.message || 'If an account exists, a reset link was sent.');
      if (res.resetUrl) setResetUrl(res.resetUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: FONT_UI,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: G.bg,
        color: G.text,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <BrandLogo />
        <h1 style={{ fontSize: 22, margin: '24px 0 8px' }}>Forgot password</h1>
        <p style={{ color: G.muted, fontSize: 13, marginBottom: 20 }}>
          Enter your account email. We will queue a one-time reset link (valid 1
          hour). All sessions are revoked after you reset.
        </p>
        {err ? <Err msg={err} /> : null}
        {msg ? (
          <div style={{ color: G.success, fontSize: 13, marginBottom: 12 }}>
            {msg}
          </div>
        ) : null}
        {resetUrl ? (
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 12 }}>
            Local reset link:{' '}
            <a href={resetUrl} style={{ color: G.gold }}>
              {resetUrl}
            </a>
          </div>
        ) : null}
        <Inp
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
        />
        <Btn full onClick={() => void go()} disabled={loading || !email.trim()}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Btn>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login" style={{ color: G.gold }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
