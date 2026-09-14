import { useEffect, useState, useMemo } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Card, SectionTitle, Pill, StatCard, StatsGrid, Icons } from '@/components/ui';
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

interface AuditItem {
  id: string;
  companyId?: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, any>;
  createdAt?: string;
}

function getAuditMeta(action: string) {
  const act = (action || '').toLowerCase();
  if (act.includes('login.success') || act.includes('auth.login')) {
    return {
      title: 'Sign-in Success',
      color: G.success,
      bg: G.successBg,
      icon: 'completed' as const,
      category: 'auth',
    };
  }
  if (act.includes('fail') || act.includes('lockout') || act.includes('denied')) {
    return {
      title: 'Sign-in Blocked / Failed',
      color: G.danger,
      bg: G.dangerBg,
      icon: 'alert' as const,
      category: 'security',
    };
  }
  if (act.includes('expiry') || act.includes('reminder')) {
    return {
      title: 'Expiry Reminder Dispatched',
      color: G.warning,
      bg: G.warningBg,
      icon: 'clock' as const,
      category: 'reminder',
    };
  }
  if (act.includes('role') || act.includes('perm') || act.includes('security')) {
    return {
      title: 'Security & Permissions',
      color: G.purple,
      bg: G.purpleBg,
      icon: 'assigned' as const,
      category: 'security',
    };
  }
  if (act.includes('doc') || act.includes('upload') || act.includes('file')) {
    return {
      title: 'Document Updated',
      color: G.info,
      bg: G.infoBg,
      icon: 'docs' as const,
      category: 'docs',
    };
  }
  return {
    title: action
      ? action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'System Event',
    color: G.gold,
    bg: G.goldBg,
    icon: 'bell' as const,
    category: 'system',
  };
}

export function ComplianceTab({
  company,
  drivers,
  driverDocs,
  assets,
  adminUser,
  apiEnabled,
  onGoDrivers,
}: any) {
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'auth' | 'security' | 'reminder'>('all');

  const complianceDocs = useMemo(
    () => (driverDocs || []).filter((d: any) => COMPLIANCE_TYPES.has(d.type)),
    [driverDocs],
  );

  // Calculate upcoming 30-day expiries for asset & driver docs
  const { assetAlerts, docAlerts, totalExpiring } = useMemo(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const cutoff = soon.toISOString().slice(0, 10);

    const aAlerts = (assets || []).filter((a: any) =>
      [a.insuranceExpiry, a.plateExpiry, a.permitExpiry].some(
        (dt: string) => dt && dt <= cutoff,
      ),
    );
    const dAlerts = (driverDocs || []).filter(
      (d: any) => d.expiryDate && d.expiryDate <= cutoff,
    );
    return {
      assetAlerts: aAlerts,
      docAlerts: dAlerts,
      totalExpiring: aAlerts.length + dAlerts.length,
    };
  }, [assets, driverDocs]);

  const loadAudit = async () => {
    if (!apiEnabled || !company?.id) return;
    setRefreshing(true);
    try {
      const rows = await auditApi.list(company.id, 100);
      setAudit(rows || []);
    } catch (e: any) {
      notify(e?.message || 'Failed to load audit log', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, apiEnabled]);

  const sendExpiryReminders = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const cutoff = soon.toISOString().slice(0, 10);

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
        body: `${company.shortName || 'FleetQuix'}: ${assetAlerts.length} asset + ${docAlerts.length} doc expiries by ${cutoff} (today ${today}).`,
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
      notify('Expiry reminder SMS sent', 'success');
      await loadAudit();
    } catch (e: any) {
      notify(e?.message || 'Reminder failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (type: string) =>
    DRIVER_DOC_TYPES.find((t) => t.id === type)?.label || type;

  // Filtered audit list
  const filteredAudit = useMemo(() => {
    let list = audit;
    if (auditFilter !== 'all') {
      list = list.filter((e) => {
        const meta = getAuditMeta(e.action);
        return meta.category === auditFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const meta = getAuditMeta(e.action);
        return (
          e.action?.toLowerCase().includes(q) ||
          e.actorName?.toLowerCase().includes(q) ||
          e.entityType?.toLowerCase().includes(q) ||
          e.entityId?.toLowerCase().includes(q) ||
          meta.title.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [audit, auditFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner & Quick Actions */}
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(61, 140, 255, 0.08) 0%, rgba(26, 34, 52, 0.8) 100%)',
          border: `1px solid rgba(61, 140, 255, 0.22)`,
          borderRadius: RADIUS.md,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(61, 140, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.gold,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {Icons.emanifest({ size: 22, color: G.gold })}
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: G.text,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Compliance & Audit Records
              <Pill color={G.gold} small>
                CBSA / ACE ACTIVE
              </Pill>
            </div>
            <div
              style={{
                fontSize: 12,
                color: G.muted,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Consolidated repository for BOL, POD, rate confirmations, operating permits, and customs documentation. Live CBSA customs filing remains simulated in eManifest.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn
            size="sm"
            variant="outline"
            onClick={onGoDrivers}
            style={{
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.drivers({ size: 16 })}
            Open Drivers
          </Btn>
          <Btn
            size="sm"
            disabled={busy}
            onClick={() => void sendExpiryReminders()}
            style={{
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.bell({ size: 16, color: G.onGold })}
            {busy ? 'Sending SMS…' : 'Send Expiry SMS'}
          </Btn>
        </div>
      </div>

      {/* Key Metrics Stats Grid */}
      <StatsGrid columns={4} style={{ marginBottom: 0 }}>
        <StatCard
          label="Compliance Artifacts"
          value={complianceDocs.length}
          subtitle="BOL, POD & Permits indexed"
          accent={G.gold}
          icon={Icons.docs({ size: 20, color: G.gold })}
        />
        <StatCard
          label="Upcoming Expiries (30d)"
          value={totalExpiring}
          subtitle={`${assetAlerts.length} assets · ${docAlerts.length} docs`}
          accent={totalExpiring > 0 ? G.warning : G.success}
          icon={Icons.clock({
            size: 20,
            color: totalExpiring > 0 ? G.warning : G.success,
          })}
        />
        <StatCard
          label="Audit Events Logged"
          value={audit.length}
          subtitle="System & security trail"
          accent={G.info}
          icon={Icons.completed({ size: 20, color: G.info })}
        />
        <StatCard
          label="Customs Protocol"
          value="CBSA / ACE"
          subtitle="Simulated live pipeline"
          accent={G.purple}
          icon={Icons.border({ size: 20, color: G.purple })}
        />
      </StatsGrid>

      {/* Section 1: Compliance Documents */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SectionTitle style={{ marginBottom: 0 }}>Compliance & Documents</SectionTitle>
            <Pill color={G.gold} small>
              {complianceDocs.length} ARTIFACTS
            </Pill>
          </div>
          <div style={{ fontSize: 12, color: G.muted }}>
            Upload documentation under Driver profiles to automatically index them here
          </div>
        </div>

        {complianceDocs.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              background: G.card2,
              borderRadius: RADIUS.md,
              border: `1px solid ${G.border}`,
              color: G.muted,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: G.card,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: G.muted,
              }}
            >
              {Icons.docs({ size: 22, color: G.muted })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
              No compliance artifacts uploaded yet
            </div>
            <div style={{ fontSize: 12, maxWidth: 420, lineHeight: 1.5 }}>
              BOLs, Proof of Deliveries, rate confirmations, operating permits, and customs documents uploaded on driver profiles will populate here automatically.
            </div>
            <Btn
              size="sm"
              variant="outline"
              onClick={onGoDrivers}
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Icons.drivers({ size: 14 })}
              Go to Drivers
            </Btn>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {complianceDocs.map((d: any) => {
              const driver = drivers?.find(
                (x: any) =>
                  x.id === d.driverId || x.driverRecordId === d.driverId,
              );
              return (
                <div
                  key={d.id}
                  style={{
                    background: G.card2,
                    border: `1px solid ${G.border}`,
                    borderRadius: RADIUS.md,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = G.gold;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = G.border;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: RADIUS.sm,
                        background: 'rgba(61, 140, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: G.gold,
                        flexShrink: 0,
                      }}
                    >
                      {Icons.docs({ size: 18, color: G.gold })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: G.text,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {labelFor(d.type)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: G.muted,
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>Driver:</span>
                        <strong style={{ color: G.text }}>
                          {driver?.name || d.driverId}
                        </strong>
                      </div>
                      {d.fileName && (
                        <div
                          style={{
                            fontSize: 11,
                            color: G.muted2,
                            marginTop: 3,
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={d.fileName}
                        >
                          {d.fileName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: `1px solid ${G.border}`,
                      paddingTop: 8,
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: G.muted }}>
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleDateString()
                        : 'Uploaded'}
                    </span>
                    <Pill color={d.status === 'verified' ? G.success : G.gold} small>
                      {(d.status || 'uploaded').toUpperCase()}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Section 2: Audit Trail */}
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SectionTitle style={{ marginBottom: 0 }}>System Audit Trail</SectionTitle>
            <Pill color={G.info} small>
              {audit.length} EVENTS
            </Pill>
          </div>

          <Btn
            size="sm"
            variant="outline"
            onClick={() => void loadAudit()}
            disabled={refreshing}
            style={{
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.clock({ size: 14 })}
            {refreshing ? 'Refreshing…' : 'Refresh Log'}
          </Btn>
        </div>

        {/* Filter and Search Bar for Audit Trail */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* Search Box with Search Icon */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 260px',
              maxWidth: 380,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: G.muted,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {Icons.search({ size: 15, color: G.muted })}
            </span>
            <input
              type="text"
              className="ts-input"
              placeholder="Search audit trail by action, actor, entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 36,
                padding: searchQuery ? '0 32px 0 36px' : '0 12px 0 36px',
                borderRadius: RADIUS.sm,
                border: `1px solid ${G.border}`,
                background: G.card2,
                color: G.text,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border-color .15s ease',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: G.muted,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                }}
              >
                {Icons.close({ size: 12, color: G.muted })}
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              boxSizing: 'border-box',
              background: G.card2,
              borderRadius: RADIUS.sm,
              padding: 3,
              border: `1px solid ${G.border}`,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setAuditFilter('all')}
              style={{
                height: '100%',
                background: auditFilter === 'all' ? G.gold : 'transparent',
                color: auditFilter === 'all' ? G.onGold : G.muted,
                border: 'none',
                padding: '0 12px',
                borderRadius: RADIUS.sm - 2,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s ease',
              }}
            >
              All ({audit.length})
            </button>
            <button
              type="button"
              onClick={() => setAuditFilter('auth')}
              style={{
                height: '100%',
                background: auditFilter === 'auth' ? G.gold : 'transparent',
                color: auditFilter === 'auth' ? G.onGold : G.muted,
                border: 'none',
                padding: '0 12px',
                borderRadius: RADIUS.sm - 2,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s ease',
              }}
            >
              Sign-ins
            </button>
            <button
              type="button"
              onClick={() => setAuditFilter('security')}
              style={{
                height: '100%',
                background: auditFilter === 'security' ? G.gold : 'transparent',
                color: auditFilter === 'security' ? G.onGold : G.muted,
                border: 'none',
                padding: '0 12px',
                borderRadius: RADIUS.sm - 2,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s ease',
              }}
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => setAuditFilter('reminder')}
              style={{
                height: '100%',
                background: auditFilter === 'reminder' ? G.gold : 'transparent',
                color: auditFilter === 'reminder' ? G.onGold : G.muted,
                border: 'none',
                padding: '0 12px',
                borderRadius: RADIUS.sm - 2,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .15s ease',
              }}
            >
              Reminders
            </button>
          </div>
        </div>

        {/* Audit List Entries */}
        {filteredAudit.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              background: G.card2,
              borderRadius: RADIUS.md,
              border: `1px solid ${G.border}`,
              color: G.muted,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {searchQuery
                ? `No audit events match your search "${searchQuery}".`
                : 'No audit events recorded for this category.'}
            </div>
            {searchQuery && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setSearchQuery('')}
                style={{ marginTop: 6 }}
              >
                Clear search
              </Btn>
            )}
          </div>
        ) : (
          <div
            style={{
              maxHeight: 560,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
            }}
          >
            {filteredAudit.map((e) => {
              const meta = getAuditMeta(e.action);
              const IconComp = Icons[meta.icon] || Icons.completed;

              return (
                <div
                  key={e.id}
                  style={{
                    background: G.card2,
                    border: `1px solid ${G.border}`,
                    borderRadius: RADIUS.md,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={(evt) => {
                    evt.currentTarget.style.borderColor = G.gold;
                  }}
                  onMouseLeave={(evt) => {
                    evt.currentTarget.style.borderColor = G.border;
                  }}
                >
                  {/* Left: Icon, Action, Actor, Entity */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: RADIUS.sm,
                        background: meta.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: meta.color,
                        flexShrink: 0,
                      }}
                    >
                      <IconComp size={16} color={meta.color} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: G.text,
                          }}
                        >
                          {meta.title}
                        </span>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: G.muted,
                            background: G.card,
                            padding: '1px 6px',
                            borderRadius: RADIUS.sm,
                            border: `1px solid ${G.border}`,
                          }}
                        >
                          {e.action}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 12,
                          color: G.muted,
                          marginTop: 3,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {Icons.user({ size: 12, color: G.muted })}
                          <strong style={{ color: G.text }}>
                            {e.actorName || 'system'}
                          </strong>
                        </span>

                        <span>·</span>

                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: G.muted2,
                          }}
                        >
                          {e.entityType}/{e.entityId || '—'}
                        </span>

                        {e.meta && Object.keys(e.meta).length > 0 && (
                          <>
                            <span>·</span>
                            <span style={{ fontSize: 11, color: G.muted }}>
                              {Object.entries(e.meta)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(', ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Timestamp */}
                  <div
                    style={{
                      fontSize: 12,
                      color: G.muted,
                      flexShrink: 0,
                      textAlign: 'right',
                    }}
                  >
                    {e.createdAt
                      ? new Date(e.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                      : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
