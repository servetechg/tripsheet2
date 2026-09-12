import { useEffect, useState } from 'react';
import { G, RADIUS, FONT_MONO } from '@/lib/theme';
import { Btn, Inp, Modal, Pill, Icons } from '@/components/ui';
import { useConfirm } from '@/context/ConfirmContext';
import {
  authApi,
  type DeviceSessionDto,
  ApiError,
} from '@/lib/api';

function parseUserAgent(ua?: string): { browser: string; os: string } {
  if (!ua) return { browser: 'Web browser', os: '' };

  let os = '';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/postman/i.test(ua)) browser = 'Postman';
  else if (/curl/i.test(ua)) browser = 'cURL';

  return { browser, os };
}

function formatIpDisplay(ip?: string): string {
  if (!ip) return '—';
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '::1' || cleaned === '127.0.0.1') {
    return 'localhost (::1)';
  }
  return cleaned;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 90) return '1m ago';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function SessionsDevicesPanel({ onClose }: { onClose: () => void }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<DeviceSessionDto[]>([]);
  const [logins, setLogins] = useState<
    Array<{
      id: string;
      success: boolean;
      reason: string;
      ip: string;
      userAgent?: string;
      createdAt: string;
    }>
  >([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const reload = () =>
    authApi
      .sessionHistory(30)
      .then((res) => {
        setRows(res.sessions || []);
        setLogins(res.loginEvents || []);
        setNote(res.idleNote || '');
      })
      .catch((e) =>
        setErr(e instanceof ApiError ? e.message : 'Failed to load sessions'),
      );

  useEffect(() => {
    void reload();
  }, []);

  const revokeSession = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Sign out device',
      message: `Sign out "${label}"? That device will need to log in again.`,
      confirmLabel: 'Sign out',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    void authApi
      .revokeSession(id)
      .then(() => reload())
      .catch((e) =>
        setErr(e instanceof ApiError ? e.message : 'Revoke failed'),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Modal open title="Sessions & Devices" onClose={onClose} maxWidth={580}>
      <p style={{ color: G.muted, fontSize: 12, marginTop: 0, marginBottom: 16 }}>
        {note ||
          'Access tokens are short-lived; refresh renews while the device session is active.'}
      </p>
      {err ? (
        <div style={{ color: G.danger, fontSize: 13, marginBottom: 12 }}>
          {err}
        </div>
      ) : null}

      {/* Active Device Sessions Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
          Active device sessions
        </span>
        <Pill color={rows.filter((r) => r.active).length ? G.success : G.muted} small>
          {rows.filter((r) => r.active).length} active
        </Pill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((s) => (
          <div
            key={s.id}
            style={{
              background: G.card2,
              border: `1px solid ${s.current ? G.gold + '55' : G.border}`,
              borderRadius: RADIUS.md,
              padding: '12px 14px',
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: G.text }}>{s.deviceLabel}</strong>
                {s.current && <Pill color={G.gold} small>this device</Pill>}
                {s.trusted && <Pill color={G.warning} small>trusted</Pill>}
              </div>
              <Pill color={s.active ? G.success : G.muted} small>
                {s.active ? 'active' : s.revokeReason || 'ended'}
              </Pill>
            </div>
            <div
              style={{
                color: G.muted,
                fontSize: 12,
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  background: G.bg,
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: `1px solid ${G.border}66`,
                  fontSize: 11,
                }}
              >
                {formatIpDisplay(s.ip)}
              </span>
              <span>
                · last seen{' '}
                {new Date(s.lastSeenAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {renameId === s.id ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Inp
                  label="Device name"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  style={{ marginBottom: 0 }}
                />
                <Btn
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void authApi
                      .patchSession(s.id, { deviceLabel: renameVal })
                      .then(() => reload())
                      .then(() => setRenameId(null))
                      .catch((e) =>
                        setErr(
                          e instanceof ApiError ? e.message : 'Rename failed',
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Save
                </Btn>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {s.active && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameId(s.id);
                      setRenameVal(s.deviceLabel);
                    }}
                  >
                    Rename
                  </Btn>
                )}
                {s.active && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void authApi
                        .patchSession(s.id, { trusted: !s.trusted })
                        .then(() => reload())
                        .catch((e) =>
                          setErr(
                            e instanceof ApiError
                              ? e.message
                              : 'Update failed',
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    {s.trusted ? 'Untrust' : 'Trust'}
                  </Btn>
                )}
                {s.active && !s.current && (
                  <Btn
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void revokeSession(s.id, s.deviceLabel)}
                  >
                    Sign out device
                  </Btn>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Sign-ins Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 24,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
          Recent sign-in history
        </span>
        <Pill color={G.muted} small>
          {logins.length} events
        </Pill>
      </div>

      {/* Recent Sign-ins List Container */}
      <div
        style={{
          background: G.card2,
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.md,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {logins.slice(0, 20).map((e, idx) => {
            const client = parseUserAgent(e.userAgent);
            const isLast = idx === logins.slice(0, 20).length - 1;
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: isLast ? 'none' : `1px solid ${G.border}44`,
                  gap: 12,
                }}
              >
                {/* Left: Status Badge & Client Info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <Pill color={e.success ? G.success : G.danger} small>
                    {e.success ? '✓ Success' : e.reason ? `✕ ${e.reason}` : '✕ Failed'}
                  </Pill>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: G.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {client.browser}{client.os ? ` on ${client.os}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: G.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          background: G.bg,
                          padding: '1px 5px',
                          borderRadius: 4,
                          border: `1px solid ${G.border}66`,
                          fontSize: 10,
                        }}
                      >
                        {formatIpDisplay(e.ip)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Relative Time + Exact Time */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: G.text }}>
                    {formatRelativeTime(e.createdAt)}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 1 }}>
                    {new Date(e.createdAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {!logins.length && (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: G.muted,
                fontSize: 12,
              }}
            >
              No sign-in events recorded yet.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
