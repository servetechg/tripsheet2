import { useEffect, useState } from 'react';
import { G, pagePlain } from '@/lib/theme';
import { Card, Pill, SectionTitle } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES, PAY_TYPES } from '@/lib/docTypes';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';
import { AdminWageModal } from '@/features/contracts/AdminWageModal';
import { documentsApi, contractsApi } from '@/lib/api';
import {
  driverRecordIdOf,
  matchesDriverRef,
} from '@/lib/driverIds';

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
  const [docTab, setDocTab] = useState('documents');
  const [uploadModal, setUploadModal] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [showWage, setShowWage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wageContract, setWageContract] = useState<any>(null);

  const recordId = driverRecordIdOf(driver);

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
    if (!window.confirm('Delete this document?')) return;
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
    ['Trips', mySheets.length, G.gold],
    ['Loads', myLoads.length, G.info],
    ['Docs', fileDocs.length, G.success],
    ['Missing', missingDocs, missingDocs > 0 ? G.danger : G.success],
  ];

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
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: `1px solid ${G.border2}`,
              color: G.muted,
              borderRadius: 7,
              padding: '7px 14px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            ← BACK
          </button>
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
        <div style={{ display: 'flex', gap: 8 }}>
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
            }}
          >
            💰 {myContract?.payRate ? 'EDIT WAGE' : 'SET WAGE'}
          </button>
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
            }}
          >
            ✏️ EDIT
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 14px 40px', maxWidth: 800, margin: '0 auto' }}>
        <Card>
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: `${G.gold}22`,
                border: `2px solid ${G.gold}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: G.text }}>
                {driver.name}
              </div>
              <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
                {driver.email}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Pill color={active ? G.gold : G.success}>
                  {active ? 'IN TRANSIT' : 'AVAILABLE'}
                </Pill>
                {driver.citizenship && (
                  <Pill color={G.info}>{driver.citizenship}</Pill>
                )}
                {driver.fastCard && <Pill color={G.purple}>FAST CARD</Pill>}
                <Pill
                  color={
                    myContract?.signedByDriver && myContract?.signedByAdmin
                      ? G.success
                      : myContract
                        ? G.gold
                        : G.danger
                  }
                >
                  📄 {contractStatus}
                </Pill>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8,
                minWidth: 260,
              }}
            >
              {stats.map(([l, v, c]) => (
                <div
                  key={String(l)}
                  style={{
                    background: G.card2,
                    borderRadius: 8,
                    padding: '10px 6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 900, color: c as string }}>
                    {v}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      letterSpacing: 1,
                      color: G.muted,
                      marginTop: 1,
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>PERSONAL INFORMATION</SectionTitle>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,1fr)',
              gap: 12,
            }}
          >
            {(
              [
                ['Phone', driver.phone || '—'],
                ['Date of Birth', driver.dob || '—'],
                ['License No.', driver.licenseNo || '—'],
                ['FAST Card', driver.fastCard || '—'],
                ['Address', driver.address || '—'],
                ['Citizenship', driver.citizenship || '—'],
                ['Emergency', driver.emergencyName || '—'],
                ['Emerg. Phone', driver.emergencyPhone || '—'],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: G.card2,
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: 2,
                    color: G.muted,
                    textTransform: 'uppercase',
                  }}
                >
                  {k}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: G.text,
                    marginTop: 3,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
          {driver.notes && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: G.card2,
                borderRadius: 8,
                fontSize: 12,
                color: G.muted,
              }}
            >
              {driver.notes}
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {(
            [
              ['documents', '📁 DOCUMENTS'],
              ['trips', '📋 TRIP SHEETS'],
              ['loads', '🚚 LOAD HISTORY'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDocTab(id)}
              style={{
                background: docTab === id ? G.gold : 'transparent',
                color: docTab === id ? G.onGold : G.muted,
                border: `1px solid ${docTab === id ? G.gold : G.border}`,
                borderRadius: 8,
                padding: '9px 18px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {docTab === 'documents' && (
          <div>
            <div
              style={{
                background: G.successTint,
                border: `1px solid ${G.success}33`,
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 11,
                color: G.muted,
              }}
            >
              📎 Upload images or PDFs. Files are stored via Cloudinary when
              configured (otherwise securely in the API).{' '}
              <span style={{ color: G.gold }}>Required docs</span> marked with *.
            </div>

            <div
              style={{
                background: G.card,
                border: `1px solid ${myContract ? G.success + '66' : G.gold + '44'}`,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>📄</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                    Employment Contract (wage)
                  </div>
                  {myContract?.payRate ? (
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                      Pay: {myContract.payUnit || 'CAD'} {myContract.payRate} ·{' '}
                      {PAY_TYPES.find((p) => p.id === myContract.payType)
                        ?.label ||
                        myContract.payType ||
                        '—'}
                      {myContract.signedByAdmin && myContract.signedByDriver ? (
                        <span style={{ color: G.success }}> · ✓ Fully signed</span>
                      ) : myContract.signedByDriver ? (
                        <span style={{ color: G.gold }}> · Driver signed</span>
                      ) : (
                        <span style={{ color: G.gold }}> · Pending driver sign</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: G.danger, marginTop: 2 }}>
                      Wage not set yet (separate from uploaded contract file)
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWage(true)}
                style={{
                  background: G.gold,
                  color: G.onGold,
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {myContract?.payRate ? '💰 EDIT WAGE' : '💰 SET WAGE'}
              </button>
            </div>

            {DRIVER_DOC_TYPES.map((docType) => {
              const doc = getDoc(docType.id);
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
                    border: `1px solid ${
                      doc
                        ? G.border
                        : docType.required
                          ? G.danger + '44'
                          : G.border
                    }`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{docType.icon}</span>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: G.text,
                          }}
                        >
                          {docType.label}
                          {docType.required && (
                            <span style={{ color: G.danger }}> *</span>
                          )}
                        </div>
                        {doc && (
                          <div
                            style={{
                              fontSize: 11,
                              color: G.muted,
                              marginTop: 2,
                            }}
                          >
                            {doc.fileName} · {doc.uploadedAt}
                            {doc.fileUrl && (
                              <span style={{ color: G.success }}> · Cloudinary</span>
                            )}
                            {doc.expiryDate && (
                              <span style={{ color: G.gold }}>
                                {' '}
                                · Expires: {doc.expiryDate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
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
                              borderRadius: 6,
                              padding: '5px 12px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            👁 VIEW
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteDoc(doc.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${G.danger}`,
                              color: G.danger,
                              borderRadius: 6,
                              padding: '5px 12px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setUploadModal(docType)}
                        style={{
                          background: G.gold,
                          color: G.onGold,
                          border: 'none',
                          borderRadius: 6,
                          padding: '7px 14px',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        {doc ? '↑ REPLACE' : '↑ UPLOAD'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                <div style={{ fontSize: 30 }}>📋</div>
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
                <div style={{ fontSize: 30 }}>🚚</div>
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
                      <div style={{ fontSize: 12, color: G.text }}>
                        🚛 {l.truckNo || '—'} · 📦 {l.trailerNo || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: G.muted }}>
                        📍 {l.origin} → {l.destination}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
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
