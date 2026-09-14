import { useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Inp } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { authApi, ApiError } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

type EmailChangeModalProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentEmail: string;
  pendingEmail?: string | null;
  onSuccess?: () => void;
};

export function EmailChangeModal({
  open,
  onClose,
  userId,
  currentEmail,
  pendingEmail,
  onSuccess,
}: EmailChangeModalProps) {
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [devLink, setDevLink] = useState('');

  const submit = async () => {
    setErr('');
    const next = newEmail.trim().toLowerCase();
    if (!next) {
      setErr('Enter the new email address.');
      return;
    }
    if (next === currentEmail.toLowerCase()) {
      setErr('New email must be different from the current email.');
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.requestEmailChange(userId, next);
      setDevLink(res.confirmUrl || '');
      notify(res.message || 'Confirmation email sent.', 'success');
      onSuccess?.();
      setNewEmail('');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Email change request failed');
    } finally {
      setBusy(false);
    }
  };

  const cancelPending = async () => {
    setBusy(true);
    try {
      await authApi.cancelEmailChange(userId);
      notify('Pending email change cancelled.', 'success');
      onSuccess?.();
      setDevLink('');
    } catch (e) {
      notify(e instanceof ApiError ? e.message : 'Cancel failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change login email">
      <div style={{ color: G.muted, fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        The new address must confirm via email before the change takes effect. Both the
        current and new addresses are notified.
      </div>
      <Inp label="Current email" value={currentEmail} disabled />
      {pendingEmail ? (
        <div
          style={{
            fontSize: 12,
            color: G.gold,
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: G.goldBg,
          }}
        >
          Pending confirmation: <strong>{pendingEmail}</strong>
        </div>
      ) : null}
      <Inp
        label="New email *"
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="new@example.com"
      />
      {err ? (
        <div style={{ color: G.danger, fontSize: 12, marginBottom: 10 }}>{err}</div>
      ) : null}
      {devLink ? (
        <div
          style={{
            fontSize: 11,
            color: G.muted,
            marginBottom: 12,
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}
        >
          Dev confirm link: {devLink}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn onClick={() => void submit()} loading={busy} loadingLabel="Sending…">
          Send confirmation
        </Btn>
        {pendingEmail ? (
          <Btn variant="outline" disabled={busy} onClick={() => void cancelPending()}>
            Cancel pending
          </Btn>
        ) : null}
        <Btn variant="ghost" disabled={busy} onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}
