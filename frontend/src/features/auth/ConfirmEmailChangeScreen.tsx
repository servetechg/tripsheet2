import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { G, FONT_UI } from '@/lib/theme';
import { Btn } from '@/components/ui';
import { Err } from '@/components/feedback/Err';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { authApi, ApiError } from '@/lib/api';

export function ConfirmEmailChangeScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const confirm = async () => {
    setErr('');
    if (!token) {
      setErr('Missing confirmation token. Use the link from your email.');
      return;
    }
    setLoading(true);
    try {
      await authApi.confirmEmailChange(token);
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Confirmation failed');
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
        <h1 style={{ fontSize: 22, margin: '24px 0 8px' }}>Confirm email change</h1>
        {done ? (
          <>
            <p style={{ color: G.muted, fontSize: 13, marginBottom: 20 }}>
              Your login email was updated. Sign in with your new address.
            </p>
            <Btn full onClick={() => navigate('/login', { replace: true })}>
              Go to sign in
            </Btn>
          </>
        ) : (
          <>
            <p style={{ color: G.muted, fontSize: 13, marginBottom: 20 }}>
              Click confirm to complete your FleetQuix email change.
            </p>
            {err ? <Err msg={err} /> : null}
            <Btn full onClick={() => void confirm()} disabled={loading}>
              {loading ? 'Confirming…' : 'Confirm new email'}
            </Btn>
          </>
        )}
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login" style={{ color: G.gold }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
