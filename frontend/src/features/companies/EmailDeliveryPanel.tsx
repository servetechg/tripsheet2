import { getApiErrorMessage } from '@/lib/format';
import { useEffect, useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Card, Inp, Pill, SectionTitle, G2, Divider, Skeleton } from '@/components/ui';
import { companiesApi, type EmailDeliveryDto } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { ErrBox } from '@/components/feedback/ErrBox';

export function EmailDeliveryPanel({
  companyId,
  adminEmail,
}: {
  companyId: string;
  adminEmail?: string;
}) {
  const [profile, setProfile] = useState<EmailDeliveryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState(adminEmail || '');

  const load = () => {
    setLoading(true);
    setLoadErr('');
    return companiesApi
      .emailDelivery(companyId)
      .then((res) => {
        setProfile(res);
        setLoadErr('');
      })
      .catch((err: Error) => {
        const msg = err?.message || 'Failed to load email settings';
        setLoadErr(msg);
        notify(msg, 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
  }, [companyId]);

  useEffect(() => {
    if (adminEmail && !testTo) setTestTo(adminEmail);
  }, [adminEmail, testTo]);

  if (loading) {
    return (
      <Card>
        <SectionTitle>Email delivery</SectionTitle>
        <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
          Loading email settings…
        </div>
        <Skeleton rows={3} height={52} />
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <SectionTitle>Email delivery</SectionTitle>
        <ErrBox msg={loadErr || 'Email settings are unavailable right now.'} />
        <div style={{ color: G.muted, fontSize: 12, marginBottom: 12 }}>
          The company service did not return email delivery settings. It may be
          restarting or temporarily unreachable.
        </div>
        <Btn onClick={() => void load()}>Retry</Btn>
      </Card>
    );
  }

  const platformReady = profile.platformEmailReady !== false;
  const platformFrom =
    profile.platformFromAddress || 'noreply@yourdomain.com';
  const replyTo =
    profile.replyToEmail || profile.tenantReplyToEmail || adminEmail || '';

  return (
    <Card>
      <SectionTitle>Email delivery</SectionTitle>
      <div style={{ color: G.muted, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        Model A: all tenants send via platform SMTP. Each company sets a{' '}
        <strong style={{ color: G.text }}>display name</strong> and{' '}
        <strong style={{ color: G.text }}>reply-to</strong> — MKX replies go to{' '}
        <em>harry@mkx.com</em>, XYZ to <em>james@xyz.com</em>. Configure SMTP once in{' '}
        <code>backend/.env</code>.
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <Pill color={platformReady ? G.success : G.danger} small>
          SMTP: {platformReady ? 'configured' : 'not configured'}
        </Pill>
        <Pill color={G.info} small>
          Model A
        </Pill>
        <Pill color={profile.active ? G.success : G.muted} small>
          {profile.active ? 'active' : 'disabled'}
        </Pill>
      </div>

      {!platformReady && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: RADIUS.md,
            background: 'rgba(248, 113, 113, 0.08)',
            border: '1px solid rgba(248, 113, 113, 0.25)',
            fontSize: 12,
            color: G.text,
            lineHeight: 1.55,
          }}
        >
          <strong>SMTP not configured.</strong> Set <code>SMTP_HOST</code>,{' '}
          <code>SMTP_USER</code>, <code>SMTP_PASS</code>, and{' '}
          <code>PLATFORM_FROM_EMAIL</code> in <code>backend/.env</code>, then restart
          services.
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          padding: '14px 16px',
          borderRadius: RADIUS.md,
          background: G.card2,
          border: `1px solid ${G.border}`,
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontSize: 11, color: G.muted, marginBottom: 6, fontWeight: 600 }}>
          PREVIEW — what drivers see
        </div>
        <div>
          <strong style={{ color: G.text }}>From:</strong>{' '}
          {profile.fromDisplayName || 'Your company'} &lt;{platformFrom}&gt;
        </div>
        <div>
          <strong style={{ color: G.text }}>Reply-To:</strong>{' '}
          {replyTo || '(set below)'}
        </div>
      </div>

      <Divider label="Tenant branding" />
      <G2 cols={2}>
        <Inp
          label="From display name"
          placeholder="MKX Logistics"
          value={profile.fromDisplayName || ''}
          onChange={(e) =>
            setProfile((p) =>
              p ? { ...p, fromDisplayName: e.target.value } : p,
            )
          }
        />
        <Inp
          label="Reply-to email (company admin / dispatch)"
          placeholder="harry@mkx.com"
          value={profile.replyToEmail || ''}
          onChange={(e) =>
            setProfile((p) =>
              p ? { ...p, replyToEmail: e.target.value } : p,
            )
          }
        />
      </G2>

      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: G.muted,
          lineHeight: 1.55,
        }}
      >
        When an admin sends an invite, their email is used as reply-to for that message.
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: G.muted,
          marginTop: 12,
        }}
      >
        <input
          type="checkbox"
          checked={profile.active !== false}
          onChange={(e) =>
            setProfile((p) => (p ? { ...p, active: e.target.checked } : p))
          }
        />
        Enable email delivery for this company
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Btn
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void companiesApi
              .patchEmailDelivery(companyId, {
                mode: 'platform',
                fromDisplayName: profile.fromDisplayName,
                replyToEmail: profile.replyToEmail,
                active: profile.active,
              })
              .then((saved) => {
                setProfile(saved);
                notify('Email settings saved');
              })
              .catch((err: Error) =>
                notify(getApiErrorMessage(err, 'Save failed'), 'error'),
              )
              .finally(() => setSaving(false));
          }}
        >
          Save
        </Btn>
      </div>

      <Divider label="Test delivery" />
      <G2 cols={2}>
        <Inp
          label="Send test to"
          value={testTo}
          onChange={(e) => setTestTo(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Btn
            variant="outline"
            disabled={testing || !testTo.trim()}
            style={{ minHeight: 42, height: 42 }}
            onClick={() => {
              setTesting(true);
              void companiesApi
                .testEmailDelivery(companyId, testTo.trim())
                .then((res) => {
                  notify(`Test email ${res.status} to ${res.to}`);
                  return load();
                })
                .catch((err: Error) =>
                  notify(getApiErrorMessage(err, 'Test send failed'), 'error'),
                )
                .finally(() => setTesting(false));
            }}
          >
            Send test email
          </Btn>
        </div>
      </G2>
      {profile.lastTestedAt && (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 8 }}>
          Last test: {new Date(profile.lastTestedAt).toLocaleString()} ·{' '}
          {profile.lastTestStatus || 'unknown'}
        </div>
      )}
    </Card>
  );
}
