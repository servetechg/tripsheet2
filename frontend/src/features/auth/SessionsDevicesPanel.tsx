import { useEffect, useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Inp, Modal } from '@/components/ui';
import { useConfirm } from '@/context/ConfirmContext';
import {
  authApi,
  type DeviceSessionDto,
  ApiError,
} from '@/lib/api';

export function SessionsDevicesPanel({ onClose }: { onClose: () => void }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState<DeviceSessionDto[]>([]);
  const [logins, setLogins] = useState<
    Array<{
      id: string;
      success: boolean;
      reason: string;
      ip: string;
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
    <Modal open title="Sessions & devices" onClose={onClose} maxWidth={560}>
      <p style={{ color: G.muted, fontSize: 12, marginTop: 0 }}>
        {note ||
          'Access tokens are short-lived; refresh renews while the device session is active.'}
      </p>
      {err ? (
        <div style={{ color: G.danger, fontSize: 13, marginBottom: 8 }}>
          {err}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((s) => (
          <div
            key={s.id}
            style={{
              border: `1px solid ${G.border}`,
              borderRadius: RADIUS.md,
              padding: 12,
              fontSize: 13,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <strong>
                {s.deviceLabel}
                {s.current ? ' · this device' : ''}
                {s.trusted ? ' · trusted' : ''}
              </strong>
              <span style={{ color: s.active ? G.success : G.muted }}>
                {s.active ? 'active' : s.revokeReason || 'ended'}
              </span>
            </div>
            <div style={{ color: G.muted, fontSize: 12, marginTop: 4 }}>
              {s.ip || '—'} · last seen{' '}
              {new Date(s.lastSeenAt).toLocaleString()}
            </div>
            {renameId === s.id ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Inp
                  label="Device name"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
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
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
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
      <h3 style={{ fontSize: 14, marginTop: 20 }}>Recent sign-ins</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {logins.slice(0, 12).map((e) => (
          <div
            key={e.id}
            style={{
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>
              {e.success ? 'ok' : e.reason || 'failed'}
              {e.ip ? ` · ${e.ip}` : ''}
            </span>
            <span style={{ color: G.muted }}>
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
        {!logins.length ? (
          <div style={{ color: G.muted, fontSize: 12 }}>No login events yet.</div>
        ) : null}
      </div>
    </Modal>
  );
}
