import { useEffect, useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { authApi, clearTokens, ApiError } from '@/lib/api';
import { useSession } from '@/context/SessionContext';

export function MfaSettingsPanel({ onClose }: { onClose: () => void }) {
  const { logout } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [companyRequires, setCompanyRequires] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'status' | 'enroll' | 'disable' | 'regen'>(
    'status',
  );
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recovery, setRecovery] = useState<string[]>([]);

  const reload = () =>
    authApi
      .mfaStatus()
      .then((s) => {
        setEnabled(s.mfaEnabled);
        setCompanyRequires(s.companyRequiresMfa);
        setRemaining(s.recoveryCodesRemaining);
      })
      .catch((e) =>
        setErr(e instanceof ApiError ? e.message : 'Failed to load MFA status'),
      );

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: G.overlay,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          background: G.card,
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.lg,
          padding: 20,
          boxShadow: G.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Authenticator (MFA)</h2>
          <Btn size="sm" variant="ghost" onClick={onClose}>
            Close
          </Btn>
        </div>
        <p style={{ color: G.muted, fontSize: 12, marginTop: 0 }}>
          TOTP apps (Google Authenticator, 1Password, Authy, etc.). Company
          policy {companyRequires ? 'requires' : 'does not require'} MFA.
        </p>
        {err ? (
          <div style={{ color: G.danger, fontSize: 13, marginBottom: 8 }}>
            {err}
          </div>
        ) : null}
        {msg ? (
          <div style={{ color: G.success, fontSize: 13, marginBottom: 8 }}>
            {msg}
          </div>
        ) : null}

        {phase === 'status' && (
          <>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              Status:{' '}
              <strong>{enabled ? 'Enabled' : 'Not enabled'}</strong>
              {enabled ? ` · ${remaining} recovery codes left` : ''}
            </div>
            {!enabled && (
              <Btn
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setErr('');
                  void authApi
                    .mfaEnrollStart()
                    .then((r) => {
                      setSecret(r.secret);
                      setQr(r.qrCodeDataUrl || '');
                      setPhase('enroll');
                      setCode('');
                    })
                    .catch((e) =>
                      setErr(
                        e instanceof ApiError ? e.message : 'Enroll failed',
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Set up authenticator
              </Btn>
            )}
            {enabled && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPhase('regen');
                    setCode('');
                    setPassword('');
                    setMsg('');
                  }}
                >
                  New recovery codes
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setPhase('disable');
                    setCode('');
                    setPassword('');
                    setMsg('');
                  }}
                >
                  Disable MFA
                </Btn>
              </div>
            )}
          </>
        )}

        {phase === 'enroll' && (
          <>
            {qr ? (
              <img
                src={qr}
                alt="MFA QR"
                style={{
                  display: 'block',
                  margin: '0 auto 12px',
                  background: '#fff',
                  borderRadius: 8,
                }}
              />
            ) : null}
            <div
              style={{
                fontSize: 12,
                color: G.muted,
                wordBreak: 'break-all',
                marginBottom: 8,
              }}
            >
              Manual key: <code>{secret}</code>
            </div>
            <Inp
              label="Confirm 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {recovery.length > 0 ? (
              <>
                <p style={{ fontSize: 13 }}>
                  MFA enabled. Save these recovery codes:
                </p>
                <ul style={{ fontSize: 13, fontFamily: 'monospace' }}>
                  {recovery.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <Btn
                  onClick={() => {
                    setRecovery([]);
                    setPhase('status');
                    void reload();
                  }}
                >
                  Done
                </Btn>
              </>
            ) : (
              <Btn
                disabled={busy || code.trim().length < 6}
                onClick={() => {
                  setBusy(true);
                  setErr('');
                  void authApi
                    .mfaEnrollConfirm(code.trim())
                    .then((r) => {
                      setRecovery(r.recoveryCodes || []);
                      setMsg(r.message || 'MFA enabled');
                    })
                    .catch((e) =>
                      setErr(
                        e instanceof ApiError ? e.message : 'Confirm failed',
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Confirm & enable
              </Btn>
            )}
          </>
        )}

        {(phase === 'disable' || phase === 'regen') && (
          <>
            <Inp
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Inp
              label="Authenticator or recovery code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                variant="ghost"
                onClick={() => {
                  setPhase('status');
                  setErr('');
                }}
              >
                Cancel
              </Btn>
              <Btn
                variant={phase === 'disable' ? 'danger' : undefined}
                disabled={busy || !password || code.trim().length < 4}
                onClick={() => {
                  setBusy(true);
                  setErr('');
                  const run =
                    phase === 'disable'
                      ? authApi.mfaDisable(password, code.trim())
                      : authApi.mfaRegenerateRecovery(password, code.trim());
                  void run
                    .then((r) => {
                      if (phase === 'disable') {
                        setMsg('MFA disabled. Sign in again.');
                        clearTokens();
                        logout();
                        onClose();
                        return;
                      }
                      const codes =
                        'recoveryCodes' in r ? r.recoveryCodes : [];
                      setRecovery(codes || []);
                      setPhase('enroll');
                      setMsg('New recovery codes ready');
                      void reload();
                    })
                    .catch((e) =>
                      setErr(
                        e instanceof ApiError ? e.message : 'Request failed',
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                {phase === 'disable' ? 'Disable MFA' : 'Regenerate'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
