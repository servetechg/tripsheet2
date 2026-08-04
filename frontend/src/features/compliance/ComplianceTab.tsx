import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, SectionTitle, Pill } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { auditApi, notificationsApi } from '@/lib/api';

const COMPLIANCE_TYPES = new Set([
  'bol',
  'pod',
  'rate_con',
  'permit',
  'border_doc',
]);

export function ComplianceTab({
  company,
  drivers,
  driverDocs,
  assets,
  adminUser,
  apiEnabled,
  onGoDrivers,
}: any) {
  const [audit, setAudit] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const complianceDocs = (driverDocs || []).filter((d: any) =>
    COMPLIANCE_TYPES.has(d.type),
  );

  const loadAudit = async () => {
    if (!apiEnabled) return;
    try {
      const rows = await auditApi.list(company.id, 100);
      setAudit(rows);
    } catch (e: any) {
      notify(e?.message || 'Failed to load audit log', 'error');
    }
  };

  useEffect(() => {
    void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

  const sendExpiryReminders = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const cutoff = soon.toISOString().slice(0, 10);

    const assetAlerts = (assets || []).filter((a: any) =>
      [a.insuranceExpiry, a.plateExpiry, a.permitExpiry].some(
        (dt: string) => dt && dt <= cutoff,
      ),
    );
    const docAlerts = (driverDocs || []).filter(
      (d: any) => d.expiryDate && d.expiryDate <= cutoff,
    );

    if (assetAlerts.length === 0 && docAlerts.length === 0) {
      notify('No expiries within 30 days');
      return;
    }

    const adminPhone = adminUser?.phone;
    if (!adminPhone) {
      notify(
        `Found ${assetAlerts.length} asset + ${docAlerts.length} doc expiries — set admin phone to SMS, or view badges.`,
        'error',
      );
      return;
    }

    try {
      setBusy(true);
      await notificationsApi.sendSms({
        to: String(adminPhone),
        body: `${company.shortName || 'TripSheet'}: ${assetAlerts.length} asset + ${docAlerts.length} doc expiries by ${cutoff} (today ${today}).`,
        companyId: company.id,
        meta: { type: 'expiry_reminder' },
      });
      await auditApi.create({
        companyId: company.id,
        actorId: adminUser?.id,
        actorName: adminUser?.name,
        action: 'expiry.reminder',
        entityType: 'company',
        entityId: company.id,
        meta: { assets: assetAlerts.length, docs: docAlerts.length },
      });
      notify('Expiry reminder SMS sent');
      await loadAudit();
    } catch (e: any) {
      notify(e?.message || 'Reminder failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (type: string) =>
    DRIVER_DOC_TYPES.find((t) => t.id === type)?.label || type;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SectionTitle>Compliance & documents</SectionTitle>
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, color: G.muted }}>
            BOL / POD / rate cons / permits / border docs (upload under Drivers).
            Live CBSA filing remains simulated in eManifest.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="outline" onClick={onGoDrivers}>
              Open Drivers
            </Btn>
            <Btn
              size="sm"
              disabled={busy}
              onClick={() => void sendExpiryReminders()}
            >
              {busy ? 'Sending…' : 'Send expiry SMS'}
            </Btn>
          </div>
        </div>
        {complianceDocs.length === 0 ? (
          <div style={{ color: G.muted, fontSize: 13 }}>
            No compliance artifacts uploaded yet.
          </div>
        ) : (
          complianceDocs.map((d: any) => {
            const driver = drivers.find(
              (x: any) =>
                x.id === d.driverId || x.driverRecordId === d.driverId,
            );
            return (
              <div
                key={d.id}
                style={{
                  borderTop: `1px solid ${G.border}`,
                  padding: '10px 0',
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{labelFor(d.type)}</strong> · {driver?.name || d.driverId}
                  {d.fileName && (
                    <span style={{ color: G.muted }}> · {d.fileName}</span>
                  )}
                </div>
                <Pill>{d.status || 'uploaded'}</Pill>
              </div>
            );
          })
        )}
      </Card>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <SectionTitle>Audit log</SectionTitle>
          <Btn size="sm" variant="outline" onClick={() => void loadAudit()}>
            Refresh
          </Btn>
        </div>
        {audit.length === 0 ? (
          <div style={{ color: G.muted, fontSize: 13 }}>No audit events yet.</div>
        ) : (
          audit.map((e) => (
            <div
              key={e.id}
              style={{
                borderTop: `1px solid ${G.border}`,
                padding: '8px 0',
                fontSize: 12,
              }}
            >
              <strong>{e.action}</strong> · {e.actorName || 'system'} ·{' '}
              {e.entityType}/{e.entityId || '—'} ·{' '}
              {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
