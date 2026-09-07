import { useEffect, useState } from 'react';
import { G, RADIUS, pagePlain } from '@/lib/theme';
import { Btn, BackButton, Card, Pill, SectionTitle, StatCard, StatsGrid, Sel, Icons } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { DRIVER_DOC_TYPES, PAY_TYPES } from '@/lib/docTypes';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';
import { AdminWageModal } from '@/features/contracts/AdminWageModal';
import { documentsApi, contractsApi, driversApi } from '@/lib/api';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  AVAILABILITY_LABELS,
  DRIVER_AVAILABILITY_STATUSES,
  DRIVER_LIFECYCLE_LABELS,
  DRIVER_TYPE_LABELS,
  QUALIFICATION_TYPE_LABELS,
  lifecycleAllowsDispatch,
} from '@/lib/driverLifecycle';
import {
  AvailabilityBadge,
  DriverEquipmentPanel,
  DriverPerformancePanel,
  DriverSafetyPanel,
  DriverTrainingPanel,
} from './DriverProfileChapter6Panels';
import {
  driverRecordIdOf,
  matchesDriverRef,
} from '@/lib/driverIds';
import { useCan } from '@/lib/permissions';
import { useSession } from '@/context/SessionContext';

export function DriverProfile({
  driver,
  company,
  loads,
  sheets,
  driverDocs,
  setDriverDocs,
  onEdit,
  onBack,
  apiEnabled,
  refreshAll,
}: any) {
  const { can } = useCan();
  const { user } = useSession();
  const confirm = useConfirm();
  const [docTab, setDocTab] = useState('documents');
  const [docFilter, setDocFilter] = useState<'all' | 'required' | 'uploaded' | 'missing'>('all');
  const w = useMediaQuery();
  const isDesktop = w >= 1024;
  const [availabilityStatus, setAvailabilityStatus] = useState(
    driver.availabilityStatus || 'available',
  );
  const [uploadModal, setUploadModal] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [showWage, setShowWage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wageContract, setWageContract] = useState<any>(null);
  const [qualifications, setQualifications] = useState<any[]>(
    driver.qualifications || [],
  );

  const recordId = driverRecordIdOf(driver);
  const isSelf = Boolean(user?.id && driver.id && user.id === driver.id);
  const canEditAvailability = can('drivers.edit') || isSelf;
  const availabilityOptions = can('drivers.edit')
    ? DRIVER_AVAILABILITY_STATUSES
    : (['available', 'off_duty', 'vacation', 'unavailable'] as const);
  const lifecycle =
    driver.lifecycleStatus || (driver.active === false ? 'suspended' : 'active');
  const lifecycleLabel =
    DRIVER_LIFECYCLE_LABELS[lifecycle as keyof typeof DRIVER_LIFECYCLE_LABELS] ||
    lifecycle;

  // Wage/terms live in Contract table — never use __contract__ document stubs
  useEffect(() => {
    if (!apiEnabled || !recordId) {
      setWageContract(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await contractsApi.list(recordId);
        if (!cancelled) {
          setWageContract(Array.isArray(list) && list.length ? list[0] : null);
        }
      } catch {
        if (!cancelled) setWageContract(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, recordId, driver.id]);

  useEffect(() => {
    if (!apiEnabled || !recordId) {
      setQualifications(driver.qualifications || []);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await driversApi.qualifications(recordId);
        if (!cancelled) setQualifications(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setQualifications(driver.qualifications || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, recordId, driver.id, driver.qualifications]);

  useEffect(() => {
    setAvailabilityStatus(driver.availabilityStatus || 'available');
  }, [driver.availabilityStatus, driver.id]);

  const saveAvailability = async () => {
    if (!apiEnabled || !recordId) return;
    try {
      setBusy(true);
      await driversApi.update(recordId, { availabilityStatus });
      await refreshAll?.();
      notify('Availability updated');
    } catch (e: any) {
      notify(e?.message || 'Failed to update availability', 'error');
    } finally {
      setBusy(false);
    }
  };

  const myContract = wageContract;

  const myLoads = loads.filter((l: any) => matchesDriverRef(l.driverId, driver));
  const mySheets = sheets.filter((s: any) =>
    matchesDriverRef(s.driverId, driver),
  );
  const myDocs = (driverDocs || []).filter((d: any) =>
    matchesDriverRef(d.driverId, driver),
  );
  const active = myLoads.find((l: any) => l.status === 'in_transit');

  const getDoc = (typeId: string) => myDocs.find((d: any) => d.type === typeId);

  const saveContract = async (c: any) => {
    try {
      setBusy(true);
      if (apiEnabled) {
        // Only send Contract-table fields. Never pass a DriverDocument id.
        const existingId = wageContract?.id;
        const body: Record<string, unknown> = {
          driverId: recordId,
          companyId: company.id,
          driverName: driver.name,
          companyName: company.name,
          startDate: c.startDate || undefined,
          payType: c.payType || undefined,
          payRate: c.payRate || undefined,
          payUnit: c.payUnit || undefined,
          teamRate: c.teamRate || undefined,
          detentionRate: c.detentionRate || undefined,
          waitRate: c.waitRate || undefined,
          fuelSurcharge: c.fuelSurcharge || undefined,
          vacationPct: c.vacationPct || undefined,
          trialDays: c.trialDays || undefined,
          noticeDays: c.noticeDays || undefined,
          benefits: c.benefits || undefined,
          signedByAdmin: true,
          signedByDriver: Boolean(c.signedByDriver),
          signedAt: new Date().toISOString(),
          payload: {
            notes: c.notes || '',
            deductions: c.deductions || '',
          },
        };
        if (existingId) body.id = existingId;

        const saved = await contractsApi.upsert(body);
        setWageContract(saved);
        await refreshAll?.();
        notify('Wage / contract saved');
      } else {
        setWageContract({
          ...c,
          id: wageContract?.id || `local-${Date.now()}`,
          driverId: recordId,
          companyId: company.id,
        });
      }
      setShowWage(false);
    } catch (e: any) {
      notify(e?.message || 'Failed to save contract', 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (typeId: string, fileData: any) => {
    try {
      setBusy(true);
      if (apiEnabled) {
        await documentsApi.upsert({
          driverId: recordId,
          companyId: company.id,
          type: typeId,
          fileName: fileData.name,
          fileSize: fileData.size,
          fileType: fileData.fileType,
          fileData: fileData.data,
          uploadedAt: new Date().toLocaleDateString('en-CA'),
          expiryDate: fileData.expiry || '',
          notes: fileData.notes || '',
          status: 'uploaded',
        });
        await refreshAll?.();
        notify('Document uploaded');
      } else {
        const existing = myDocs.find((d: any) => d.type === typeId);
        const newDoc = {
          id: existing?.id || `local-${Date.now()}`,
          driverId: recordId,
          companyId: company.id,
          type: typeId,
          fileName: fileData.name,
          fileSize: fileData.size,
          fileType: fileData.fileType,
          fileData: fileData.data,
          uploadedAt: new Date().toLocaleDateString('en-CA'),
          expiryDate: fileData.expiry || '',
          status: 'uploaded',
          notes: fileData.notes || '',
        };
        setDriverDocs((p: any[]) =>
          existing
            ? p.map((d: any) => (d.id === existing.id ? newDoc : d))
            : [...p, newDoc],
        );
      }
      setUploadModal(null);
    } catch (e: any) {
      notify(e?.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async (docId: string) => {
    const ok = await confirm({
      title: 'Delete document',
      message: 'Delete this document?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      if (apiEnabled) {
        await documentsApi.remove(docId);
        await refreshAll?.();
      } else {
        setDriverDocs((p: any[]) => p.filter((d: any) => d.id !== docId));
      }
    } catch (e: any) {
      notify(e?.message || 'Delete failed', 'error');
    }
  };

  const fileDocs = myDocs.filter((d: any) => d.type !== '__contract__');
  const missingDocs = DRIVER_DOC_TYPES.filter(
    (t) => t.required && !getDoc(t.id),
  ).length;
  const contractStatus = myContract?.payRate
    ? myContract.signedByDriver && myContract.signedByAdmin
      ? '✓ Fully Signed'
      : myContract.signedByDriver
        ? 'Driver Signed'
        : 'Wage set'
    : 'No Wage';
  const stats = [
    {
      label: 'Trips',
      value: mySheets.length,
      color: G.warning,
      icon: Icons.sheets({ size: 18, color: G.warning }),
    },
    {
      label: 'Loads',
      value: myLoads.length,
      color: G.info,
      icon: Icons.dispatch({ size: 18, color: G.info }),
    },
    {
      label: 'Docs',
      value: fileDocs.length,
      color: G.success,
      icon: Icons.docs({ size: 18, color: G.success }),
    },
    {
      label: 'Missing',
      value: missingDocs,
      color: missingDocs > 0 ? G.danger : G.success,
      icon: Icons.alert({
        size: 18,
        color: missingDocs > 0 ? G.danger : G.success,
      }),
    },
  ];

  const filteredDocs = DRIVER_DOC_TYPES.filter((docType) => {
    const doc = getDoc(docType.id);
    if (docFilter === 'required') return docType.required;
    if (docFilter === 'uploaded') return Boolean(doc);
    if (docFilter === 'missing') return docType.required && !doc;
    return true;
  });

  const PROFILE_TABS = [
    ['documents', 'Documents', Icons.docs],
    ['qualifications', 'Qualifications', Icons.completed],
    ['equipment', 'Equipment', Icons.truck],
    ['safety', 'Safety', Icons.alert],
    ['training', 'Training', Icons.completed],
    ['performance', 'Performance', Icons.chart],
    ['trips', 'Trip Sheets', Icons.sheets],
    ['loads', 'Load History', Icons.dispatch],
  ] as const;

  return (
    <div style={{ ...pagePlain() }}>
      <div
        style={{
          background: G.card,
          borderBottom: `1px solid ${G.border}`,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BackButton onClick={onBack} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: G.gold,
              letterSpacing: 2,
            }}
          >
            DRIVER PROFILE
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {can('drivers.approve') && lifecycle === 'pending_review' && (
            <button
              type="button"
              onClick={async () => {
                if (!recordId) return;
                try {
                  await driversApi.approve(recordId);
                  await refreshAll?.();
                  notify(`${driver.name} approved`);
                } catch (e: any) {
                  notify(e?.message || 'Approve failed', 'error');
                }
              }}
              style={{
                background: G.success,
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              APPROVE
            </button>
          )}
          {can('drivers.suspend') && lifecycle === 'active' && (
            <button
              type="button"
              onClick={async () => {
                if (!recordId) return;
                const ok = await confirm({
                  title: 'Suspend driver',
                  message: `Suspend ${driver.name}?`,
                  confirmLabel: 'Suspend',
                  variant: 'danger',
                });
                if (!ok) return;
                try {
                  await driversApi.suspend(recordId);
                  await refreshAll?.();
                  notify(`${driver.name} suspended`);
                } catch (e: any) {
                  notify(e?.message || 'Suspend failed', 'error');
                }
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${G.warning}`,
                color: G.warning,
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              SUSPEND
            </button>
          )}
          {can('drivers.wage.edit') && (
            <button
              type="button"
              onClick={() => setShowWage(true)}
              style={{
                background: G.goldTint,
                border: `1px solid ${G.gold}`,
                color: G.gold,
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Icons.contract({ size: 16, color: G.gold })}
              {myContract?.payRate ? 'EDIT WAGE' : 'SET WAGE'}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            style={{
              background: G.gold,
              color: G.onGold,
              border: 'none',
              borderRadius: 7,
              padding: '8px 16px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.edit({ size: 16, color: G.onGold })}
            EDIT
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 0px 60px 0px', maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Driver Hero Header Card */}
        <Card style={{ marginBottom: 18, padding: '20px 24px' }}>
          <div
            style={{
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 280, flex: 1 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: RADIUS.lg,
                  background: `linear-gradient(135deg, ${G.gold}22, ${G.gold}44)`,
                  border: `1.5px solid ${G.gold}88`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {Icons.driver({ size: 34, color: G.gold })}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: G.text, margin: 0, letterSpacing: -0.5 }}>
                    {driver.name}
                  </h1>
                  {active ? (
                    <Pill color={G.gold}>IN TRANSIT</Pill>
                  ) : (
                    <AvailabilityBadge status={driver.availabilityStatus} />
                  )}
                  <Pill
                    color={
                      lifecycle === 'active'
                        ? G.success
                        : lifecycle === 'pending_review'
                          ? G.warning
                          : lifecycle === 'suspended'
                            ? G.danger
                            : G.muted
                    }
                  >
                    {lifecycleLabel}
                  </Pill>
                  {!lifecycleAllowsDispatch(lifecycle) && (
                    <Pill color={G.danger}>Not dispatch-eligible</Pill>
                  )}
                  {driver.citizenship && (
                    <Pill color={G.info}>{driver.citizenship}</Pill>
                  )}
                  {driver.fastCard && <Pill color={G.purple}>FAST CARD</Pill>}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 13,
                    color: G.muted,
                    marginTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {driver.email && <span>{driver.email}</span>}
                  {driver.phone && <span>· {driver.phone}</span>}
                  {driver.branchId && <span>· Branch: {driver.branchId}</span>}
                  <span>· {DRIVER_TYPE_LABELS[driver.driverType as keyof typeof DRIVER_TYPE_LABELS] || driver.driverType || 'Company Driver'}</span>
                  <span style={{ color: myContract?.signedByDriver && myContract?.signedByAdmin ? G.success : myContract ? G.gold : G.danger }}>
                    · {contractStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: G.card2,
                border: `1px solid ${G.border}`,
                borderRadius: RADIUS.lg,
                padding: '4px',
                gap: 2,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                flexWrap: 'wrap',
              }}
            >
              {stats.map((s, idx) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    borderRadius: RADIUS.md,
                    borderRight: isDesktop && idx < stats.length - 1 ? `1px solid ${G.border}55` : 'none',
                    minWidth: 84,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: RADIUS.md,
                      background: `${s.color}15`,
                      border: `1px solid ${s.color}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: G.muted,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1.15 }}>
                      {s.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 2-Column Responsive Body */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? '310px 1fr' : '1fr',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Left Sidebar: Availability & Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {canEditAvailability && (
              <Card>
                <SectionTitle>AVAILABILITY</SectionTitle>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Sel
                      label="Status"
                      style={{ marginBottom: 0 }}
                      value={availabilityStatus}
                      onChange={(e) => setAvailabilityStatus(e.target.value)}
                    >
                      {availabilityOptions.map((s) => (
                        <option key={s} value={s}>
                          {AVAILABILITY_LABELS[s as keyof typeof AVAILABILITY_LABELS] || s}
                        </option>
                      ))}
                    </Sel>
                  </div>
                  <Btn
                    size="md"
                    style={{ height: 42, minHeight: 42, padding: '0 16px', flexShrink: 0 }}
                    disabled={busy || availabilityStatus === (driver.availabilityStatus || 'available')}
                    onClick={() => void saveAvailability()}
                  >
                    Save
                  </Btn>
                </div>
              </Card>
            )}

            {/* Employment Details Card */}
            <Card>
              <SectionTitle>Employment Details</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(
                  [
                    ['Employee #', driver.employeeNumber || '—'],
                    ['Driver Type', DRIVER_TYPE_LABELS[driver.driverType as keyof typeof DRIVER_TYPE_LABELS] || driver.driverType || 'Company Driver'],
                    ['Hire Date', driver.hireDate || '—'],
                    ['Probation Ends', driver.probationEndDate || '—'],
                    ['Seniority Date', driver.seniorityDate || '—'],
                    ['Employment Status', driver.employmentStatus || '—'],
                    ['Branch', driver.branchId || '—'],
                    ['Language', driver.preferredLanguage || '—'],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: `1px solid ${G.border}33`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: G.muted }}>{k}</span>
                    <span style={{ color: v === '—' ? G.muted : G.text, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              {driver.ownerOperatorProfile &&
                typeof driver.ownerOperatorProfile === 'object' && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: G.card2,
                      borderRadius: RADIUS.md,
                      fontSize: 12,
                      color: G.muted,
                      border: `1px solid ${G.border}`,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: G.text, marginBottom: 2 }}>Owner-Operator Profile</div>
                    {(driver.ownerOperatorProfile as any).corporationName ||
                      (driver.ownerOperatorProfile as any).gstHstNumber ||
                      'Configured'}
                  </div>
                )}
            </Card>

            {/* Personal Information Card */}
            <Card>
              <SectionTitle>Personal & Contact</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(
                  [
                    ['Phone', driver.phone || '—'],
                    ['Date of Birth', driver.dob || '—'],
                    ['License No.', driver.licenseNo || '—'],
                    ['FAST Card', driver.fastCard || '—'],
                    ['Address', driver.address || '—'],
                    ['Citizenship', driver.citizenship || '—'],
                    ['Emergency Contact', driver.emergencyName || '—'],
                    ['Emerg. Phone', driver.emergencyPhone || '—'],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '7px 0',
                      borderBottom: `1px solid ${G.border}33`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: G.muted }}>{k}</span>
                    <span style={{ color: v === '—' ? G.muted : G.text, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
              {driver.notes && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    background: G.card2,
                    borderRadius: RADIUS.md,
                    fontSize: 12,
                    color: G.muted,
                    border: `1px solid ${G.border}`,
                  }}
                >
                  <div style={{ fontWeight: 600, color: G.text, marginBottom: 2 }}>Notes</div>
                  {driver.notes}
                </div>
              )}
            </Card>
          </div>

          {/* Right Main Column: Tabs & Tab Content */}
          <div style={{ minWidth: 0 }}>
            {/* Tabs Navigation Toolbar */}
            <div
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: RADIUS.lg,
                padding: '6px 8px',
                marginBottom: 16,
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
              }}
            >
              {PROFILE_TABS.map(([id, label, Icon]) => {
                const activeTab = docTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDocTab(id)}
                    style={{
                      background: activeTab ? G.gold : 'transparent',
                      color: activeTab ? G.onGold : G.muted2,
                      border: 'none',
                      borderRadius: RADIUS.md,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: activeTab ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                      transition: 'all .15s ease',
                      boxShadow: activeTab ? '0 2px 8px rgba(61, 140, 255, 0.3)' : 'none',
                    }}
                  >
                    {Icon({
                      size: 14,
                      color: activeTab ? G.onGold : G.muted,
                    })}
                    {label}
                  </button>
                );
              })}
            </div>

            {docTab === 'documents' && (
              <div>
                {/* Status Notice Banner */}
                <div
                  style={{
                    background: missingDocs > 0 ? G.dangerBg : G.successTint,
                    border: `1px solid ${missingDocs > 0 ? G.danger + '33' : G.success + '33'}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 14,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: missingDocs > 0 ? G.danger : G.success }}>
                    {missingDocs > 0
                      ? Icons.alert({ size: 16, color: G.danger })
                      : Icons.completed({ size: 16, color: G.success })}
                    <span>
                      {missingDocs > 0
                        ? `${missingDocs} required document(s) missing — complete required uploads before dispatching.`
                        : 'All required documents verified. Driver is dispatch-eligible.'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: G.muted }}>
                    Securely stored in Cloudinary / DB
                  </span>
                </div>

                {/* Employment Contract (Wage) Card */}
                <div
                  style={{
                    background: G.card,
                    border: `1px solid ${myContract ? G.success + '66' : G.gold + '44'}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    marginBottom: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: RADIUS.md,
                        background: `${G.gold}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {Icons.contract({ size: 22, color: G.gold })}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>
                        Employment Contract & Compensation
                      </div>
                      {can('drivers.wage.view') && myContract?.payRate ? (
                        <div style={{ fontSize: 12, color: G.muted, marginTop: 3 }}>
                          Pay: <strong style={{ color: G.text }}>{myContract.payUnit || 'CAD'} {myContract.payRate}</strong> ·{' '}
                          {PAY_TYPES.find((p) => p.id === myContract.payType)?.label || myContract.payType || '—'}
                          {myContract.signedByAdmin && myContract.signedByDriver ? (
                            <span style={{ color: G.success, fontWeight: 600 }}> · ✓ Fully Signed</span>
                          ) : myContract.signedByDriver ? (
                            <span style={{ color: G.gold, fontWeight: 600 }}> · Driver Signed</span>
                          ) : (
                            <span style={{ color: G.gold, fontWeight: 600 }}> · Pending Driver Signature</span>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: G.danger, marginTop: 3 }}>
                          Wage not configured yet (separate from uploaded contract file)
                        </div>
                      )}
                    </div>
                  </div>
                  {can('drivers.wage.edit') && (
                    <button
                      type="button"
                      onClick={() => setShowWage(true)}
                      style={{
                        background: G.gold,
                        color: G.onGold,
                        border: 'none',
                        borderRadius: RADIUS.md,
                        padding: '9px 18px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(61, 140, 255, 0.25)',
                      }}
                    >
                      {Icons.contract({ size: 16, color: G.onGold })}
                      {myContract?.payRate ? 'EDIT WAGE' : 'SET WAGE'}
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(
                      [
                        ['all', `All (${DRIVER_DOC_TYPES.length})`],
                        ['required', `Required (${DRIVER_DOC_TYPES.filter((t) => t.required).length})`],
                        ['uploaded', `Uploaded (${fileDocs.length})`],
                        ['missing', `Missing (${missingDocs})`],
                      ] as const
                    ).map(([val, label]) => {
                      const activeFilter = docFilter === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDocFilter(val)}
                          style={{
                            background: activeFilter ? G.goldBg : G.card,
                            color: activeFilter ? G.gold : G.muted,
                            border: `1px solid ${activeFilter ? G.gold : G.border}`,
                            borderRadius: RADIUS.pill,
                            padding: '6px 14px',
                            fontSize: 11,
                            fontWeight: activeFilter ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    Showing {filteredDocs.length} of {DRIVER_DOC_TYPES.length} documents
                  </div>
                </div>

                {/* Document Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredDocs.map((docType) => {
                    const doc = getDoc(docType.id);
                    const isMissing = docType.required && !doc;
                    const statusColor = doc
                      ? doc.status === 'expired'
                        ? G.danger
                        : doc.status === 'expiring_soon'
                          ? G.gold
                          : G.success
                      : docType.required
                        ? G.danger
                        : G.muted;
                    const statusLabel = doc
                      ? doc.status === 'expired'
                        ? 'EXPIRED'
                        : doc.status === 'expiring_soon'
                          ? 'EXPIRING SOON'
                          : 'UPLOADED'
                      : docType.required
                        ? 'MISSING *'
                        : 'NOT UPLOADED';
                    return (
                      <div
                        key={docType.id}
                        style={{
                          background: G.card,
                          border: `1px solid ${doc
                              ? G.border
                              : docType.required
                                ? G.danger + '44'
                                : G.border
                            }`,
                          borderRadius: 10,
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          transition: 'border-color .15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220, flex: 1 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: RADIUS.md,
                              background: doc ? G.successBg : isMissing ? G.dangerBg : G.card2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {Icons.docs({
                              size: 18,
                              color: doc ? G.success : isMissing ? G.danger : G.muted,
                            })}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                              {docType.label}
                              {docType.required && <span style={{ color: G.danger }}> *</span>}
                            </div>
                            {doc ? (
                              <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                                <span style={{ color: G.text, fontWeight: 500 }}>{doc.fileName}</span>
                                <span> · {doc.uploadedAt}</span>
                                {doc.expiryDate && (
                                  <span style={{ color: G.gold }}> · Expires: {doc.expiryDate}</span>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: docType.required ? G.danger : G.muted, marginTop: 2 }}>
                                {docType.required ? 'Mandatory for dispatch approval' : 'Optional document'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Pill color={statusColor}>{statusLabel}</Pill>
                          {doc && (
                            <>
                              <button
                                type="button"
                                onClick={() => setViewDoc(doc)}
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${G.gold}`,
                                  color: G.gold,
                                  borderRadius: RADIUS.sm,
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                {Icons.eye({ size: 14, color: G.gold })}
                                VIEW
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteDoc(doc.id)}
                                title="Delete document"
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${G.danger}44`,
                                  color: G.danger,
                                  borderRadius: RADIUS.sm,
                                  padding: '6px 10px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                {Icons.trash({ size: 14, color: G.danger })}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setUploadModal(docType)}
                            style={{
                              background: doc ? G.card2 : G.gold,
                              color: doc ? G.text : G.onGold,
                              border: doc ? `1px solid ${G.border2}` : 'none',
                              borderRadius: RADIUS.sm,
                              padding: '7px 14px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {Icons.upload({ size: 14, color: doc ? G.muted : G.onGold })}
                            {doc ? 'REPLACE' : 'UPLOAD'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {docTab === 'qualifications' && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 3,
                    color: G.muted,
                    marginBottom: 12,
                  }}
                >
                  STRUCTURED QUALIFICATIONS ({qualifications.length})
                </div>
                {qualifications.length === 0 ? (
                  <Card style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ color: G.muted }}>
                      No qualifications on file. Upload licence/medical docs or edit profile to sync.
                    </div>
                  </Card>
                ) : (
                  qualifications.map((q: any) => (
                    <Card key={q.id} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: G.text }}>
                            {QUALIFICATION_TYPE_LABELS[q.type as keyof typeof QUALIFICATION_TYPE_LABELS] || q.type}
                          </div>
                          <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
                            {q.number ? `# ${q.number}` : 'No number'}
                            {q.expiryDate ? ` · Expires ${q.expiryDate}` : ''}
                          </div>
                        </div>
                        <Pill
                          color={
                            q.status === 'valid'
                              ? G.success
                              : q.status === 'expiring_soon'
                                ? G.warning
                                : G.danger
                          }
                        >
                          {(q.status || 'unknown').replace('_', ' ')}
                        </Pill>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {docTab === 'equipment' && (
              <DriverEquipmentPanel
                recordId={recordId}
                companyId={company.id}
                apiEnabled={apiEnabled}
                refreshAll={refreshAll}
              />
            )}

            {docTab === 'safety' && (
              <DriverSafetyPanel
                recordId={recordId}
                companyId={company.id}
                apiEnabled={apiEnabled}
              />
            )}

            {docTab === 'training' && (
              <DriverTrainingPanel
                recordId={recordId}
                companyId={company.id}
                apiEnabled={apiEnabled}
              />
            )}

            {docTab === 'performance' && (
              <DriverPerformancePanel recordId={recordId} apiEnabled={apiEnabled} />
            )}

            {docTab === 'trips' && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 3,
                    color: G.muted,
                    marginBottom: 12,
                  }}
                >
                  TRIP SHEETS ({mySheets.length})
                </div>
                {mySheets.length === 0 ? (
                  <Card style={{ textAlign: 'center', padding: 40 }}>
                    <div>{Icons.sheets({ size: 36, color: G.muted })}</div>
                    <div style={{ color: G.muted, marginTop: 8 }}>
                      No trip sheets yet.
                    </div>
                  </Card>
                ) : (
                  [...mySheets]
                    .sort((a, b) =>
                      (b.createdAt || '') >= (a.createdAt || '') ? 1 : -1,
                    )
                    .map((s: any) => {
                      const cad = (s.expenses || [])
                        .filter((e: any) => e.currency === 'CAD')
                        .reduce(
                          (a: number, e: any) => a + (parseFloat(e.amount) || 0),
                          0,
                        );
                      return (
                        <Card key={s.id}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>
                                Truck #{s.header?.truckNo || '—'}
                              </div>
                              <div style={{ fontSize: 11, color: G.muted }}>
                                {s.header?.startDate} → {s.header?.endDate}
                              </div>
                              <div style={{ fontSize: 11, color: G.muted }}>
                                {s.trips?.length || 0} leg(s) ·{' '}
                                {s.expenses?.length || 0} expense(s)
                              </div>
                              {cad > 0 && (
                                <div style={{ fontSize: 11, color: G.success }}>
                                  CAD {cad.toFixed(2)}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: G.gold }}>
                              {s.createdAt}
                            </div>
                          </div>
                        </Card>
                      );
                    })
                )}
              </div>
            )}

            {docTab === 'loads' && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 3,
                    color: G.muted,
                    marginBottom: 12,
                  }}
                >
                  LOAD HISTORY ({myLoads.length})
                </div>
                {myLoads.length === 0 ? (
                  <Card style={{ textAlign: 'center', padding: 40 }}>
                    <div>{Icons.dispatch({ size: 36, color: G.muted })}</div>
                    <div style={{ color: G.muted, marginTop: 8 }}>No loads yet.</div>
                  </Card>
                ) : (
                  myLoads.map((l: any) => (
                    <Card key={l.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: G.gold }}>
                              {l.id}
                            </span>
                            <Pill
                              color={
                                (
                                  {
                                    assigned: G.info,
                                    in_transit: G.gold,
                                    delivered: G.success,
                                    cancelled: G.danger,
                                  } as Record<string, string>
                                )[l.status] || G.muted
                              }
                            >
                              {String(l.status).replace('_', ' ').toUpperCase()}
                            </Pill>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: G.text,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            {Icons.truck({ size: 14, color: G.text })}
                            {l.truckNo || '—'}
                            <span>·</span>
                            {Icons.trailer({ size: 14, color: G.text })}
                            {l.trailerNo || '—'}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: G.muted,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {Icons.pin({ size: 14, color: G.muted })}
                            {l.origin} → {l.destination}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadModal && (
        <DocUploadModal
          docType={uploadModal}
          onUpload={uploadDoc}
          onClose={() => setUploadModal(null)}
        />
      )}
      {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
      {showWage && (
        <AdminWageModal
          driver={driver}
          company={company}
          existingContract={myContract}
          onSave={saveContract}
          onClose={() => setShowWage(false)}
        />
      )}
    </div>
  );
}
