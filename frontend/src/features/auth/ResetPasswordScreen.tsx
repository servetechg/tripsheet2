import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { G, FONT_UI } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { authApi, ApiError } from '@/lib/api';

export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setErr('');
    if (!token) {
      setErr('Missing reset token. Use the link from your email.');
      return;
    }
    if (password.length < 4) {
      setErr('Password is too short');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      navigate('/login', { replace: true, state: { resetOk: true } });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Reset failed');
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
        <h1 style={{ fontSize: 22, margin: '24px 0 8px' }}>Set new password</h1>
        <p style={{ color: G.muted, fontSize: 13, marginBottom: 20 }}>
          Choose a new password. You will need to sign in again afterward.
        </p>
        {err ? <Err msg={err} /> : null}
        <Inp
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Inp
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
        />
        <Btn full onClick={() => void go()} disabled={loading}>
          {loading ? 'Saving…' : 'Update password'}
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
