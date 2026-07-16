import { useState, useEffect } from 'react';
import { G, FONT_MONO } from '@/lib/theme';
import { Btn, Card, Pill, SectionTitle, Skeleton } from '@/components/ui';
import { useFakeLoad } from '@/hooks/useFakeLoad';
import { uid } from '@/lib/uid';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES, PAY_TYPES } from '@/lib/docTypes';
import { AppShell } from '@/components/layout/AppShell';
import { TripSheetForm } from '@/features/trip-sheets/TripSheetForm';
import { PrintPreview } from '@/features/trip-sheets/PrintPreview';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';
import {
  tripSheetsApi,
  documentsApi,
  contractsApi,
} from '@/lib/api';
import {
  driverRecordIdOf,
  matchesDriverRef,
} from '@/lib/driverIds';

export function DriverDashboard({
  user,
  company,
  sheets,
  setSheets,
  loads,
  driverDocs,
  setDriverDocs,
  onLogout,
  themeMode,
  onToggleTheme,
  apiEnabled,
  refreshAll,
  activeTab,
  onTabChange,
}: any) {
  const tab = activeTab || 'sheets';
  const setTab = onTabChange || (() => {});
  const [formOpen, setForm] = useState(false);
  const [editSheet, setEditSheet] = useState<any>(null);
  const [previewS, setPreview] = useState<any>(null);
  const sn = company.shortName;
  const recordId = driverRecordIdOf(user);
  const mySheets = sheets.filter(
    (s: any) =>
      s.companyId === company.id && matchesDriverRef(s.driverId, user),
  );
  const sortedSheets = [...mySheets].sort((a, b) =>
    (b.createdAt || '') >= (a.createdAt || '') ? 1 : -1,
  );
  const myLoad = loads.find(
    (l: any) =>
      matchesDriverRef(l.driverId, user) && l.status === 'in_transit',
  );
  const myDocs = (driverDocs || []).filter(
    (d: any) =>
      matchesDriverRef(d.driverId, user) && d.type !== '__contract__',
  );
  const localContract = (driverDocs || []).find(
    (d: any) =>
      matchesDriverRef(d.driverId, user) && d.type === '__contract__',
  );
  const [apiContract, setApiContract] = useState<any>(null);
  const myContract = apiEnabled ? apiContract || localContract : localContract;
  const [uploadModal, setUploadModal] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const tabLoading = useFakeLoad(tab, 350);

  useEffect(() => {
    if (!apiEnabled || tab !== 'contract') return;
    let cancelled = false;
    (async () => {
      try {
        const list = await contractsApi.list(recordId);
        if (!cancelled && Array.isArray(list) && list.length) {
          const c = list[0];
          setApiContract({
            ...c,
            type: '__contract__',
            driverId: recordId,
            companyId: company.id,
            signedByDriver: !!c.signedByDriver || !!c.driverSignedAt,
            driverSignedAt: c.driverSignedAt,
            updatedAt: c.updatedAt || c.employerSignedAt,
          });
        }
      } catch {
        // keep local
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, tab, recordId, company.id]);

  const saveDoc = async (typeId: string, fileData: any) => {
    const nd = {
      id: uid(),
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
    };
    try {
      if (apiEnabled) {
        await documentsApi.upsert({
          driverId: recordId,
          companyId: company.id,
          type: typeId,
          fileName: fileData.name,
          fileSize: fileData.size,
          fileType: fileData.fileType,
          fileData: fileData.data,
          uploadedAt: nd.uploadedAt,
          expiryDate: fileData.expiry || '',
          notes: fileData.notes || '',
          status: 'uploaded',
        });
        await refreshAll?.();
      } else {
        setDriverDocs((p: any[]) => {
          const ex = p.findIndex(
            (d) => matchesDriverRef(d.driverId, user) && d.type === typeId,
          );
          if (ex >= 0) {
            const n = [...p];
            n[ex] = nd;
            return n;
          }
          return [...p, nd];
        });
      }
    } catch (e: any) {
      notify(e?.message || 'Document upload failed', 'error');
    }
  };

  const saveSheet = async (s: any) => {
    try {
      if (apiEnabled) {
        const exists = sheets.find((x: any) => x.id === s.id);
        if (exists) {
          await tripSheetsApi.update(s.id, {
            header: s.header,
            trips: s.trips,
            expenses: s.expenses,
            notes: s.notes,
          });
        } else {
          await tripSheetsApi.create({
            companyId: company.id,
            driverId: user.id,
            header: s.header,
            trips: s.trips,
            expenses: s.expenses,
            notes: s.notes,
          });
        }
        await refreshAll?.();
      } else {
        setSheets((p: any[]) => {
          const ex = p.find((x) => x.id === s.id);
          return ex ? p.map((x) => (x.id === s.id ? s : x)) : [...p, s];
        });
      }
      setForm(false);
      setEditSheet(null);
      notify(
        s.id && sheets.find((x: any) => x.id === s.id)
          ? 'Trip sheet updated.'
          : 'Trip sheet saved.',
      );
    } catch (e: any) {
      notify(e?.message || 'Failed to save trip sheet', 'error');
      throw e;
    }
  };

  const signContract = async () => {
    if (myContract?.signedByDriver) return;
    try {
      if (apiEnabled && myContract?.id) {
        await contractsApi.sign(myContract.id, { role: 'driver' });
        await refreshAll?.();
        const list = await contractsApi.list(recordId);
        if (Array.isArray(list) && list.length) {
          const c = list[0];
          setApiContract({
            ...c,
            type: '__contract__',
            driverId: recordId,
            companyId: company.id,
            signedByDriver: true,
            driverSignedAt:
              c.driverSignedAt || new Date().toLocaleDateString('en-CA'),
            updatedAt: c.updatedAt || c.employerSignedAt,
          });
        }
      } else {
        setDriverDocs((p: any[]) =>
          p.map((d) =>
            matchesDriverRef(d.driverId, user) && d.type === '__contract__'
              ? {
                  ...d,
                  signedByDriver: true,
                  driverSignedAt: new Date().toLocaleDateString('en-CA'),
                }
              : d,
          ),
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Sign failed', 'error');
    }
  };

  const openNew = () => {
    setEditSheet(null);
    setForm(true);
  };
  const openEdit = (s: any, e: any) => {
    e.stopPropagation();
    setEditSheet(s);
    setForm(true);
  };
  const openPDF = (s: any, e: any) => {
    e.stopPropagation();
    setPreview(s);
  };

  if (formOpen)
    return (
      <TripSheetForm
        company={company}
        user={user}
        editSheet={editSheet}
        onSave={saveSheet}
        onBack={() => {
          setForm(false);
          setEditSheet(null);
        }}
      />
    );
  if (previewS)
    return (
      <PrintPreview
        company={company}
        header={previewS.header}
        trips={previewS.trips}
        expenses={previewS.expenses}
        notes={previewS.notes}
        onBack={() => setPreview(null)}
      />
    );

  const TABS = [
    { id: 'sheets', icon: '📋', label: 'Sheets' },
    { id: 'docs', icon: '📁', label: 'My Docs' },
    { id: 'contract', icon: '📄', label: 'Contract' },
    { id: 'status', icon: '🚛', label: 'My Load' },
  ];

  return (
    <AppShell
      logo={sn}
      subtitle="Driver"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
      topRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: G.muted }}>{user.name}</span>
          <Btn
            variant="outline"
            onClick={onLogout}
            style={{ fontSize: 11, padding: '8px 14px' }}
          >
            LOGOUT
          </Btn>
        </div>
      }
    >
      {tabLoading ? (
        <Skeleton rows={3} />
      ) : (
        <>
          {tab === 'sheets' && (
            <div>
              {myLoad && (
                <div
                  style={{
                    background: G.gold + '18',
                    border: `1px solid ${G.gold}33`,
                    borderRadius: 12,
                    padding: '12px 16px',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: 2,
                      color: G.gold,
                      marginBottom: 4,
                    }}
                  >
                    ● ACTIVE LOAD
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {myLoad.id} · {myLoad.origin} → {myLoad.destination}
                  </div>
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    🚛 Truck {myLoad.truckNo || '—'} · 📦 Trailer{' '}
                    {myLoad.trailerNo || '—'}
                  </div>
                  {myLoad.eta && (
                    <div style={{ fontSize: 11, color: G.gold, marginTop: 2 }}>
                      ETA: {myLoad.eta}
                    </div>
                  )}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ fontSize: 10, letterSpacing: 3, color: G.muted }}
                >
                  MY SHEETS ({mySheets.length})
                </div>
                <Btn onClick={openNew}>+ NEW SHEET</Btn>
              </div>
              {mySheets.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 40 }}>🚛</div>
                  <div
                    style={{ color: G.muted, marginTop: 12, marginBottom: 20 }}
                  >
                    No trip sheets yet.
                  </div>
                  <Btn onClick={openNew}>CREATE TRIP SHEET</Btn>
                </Card>
              ) : (
                sortedSheets.map((s: any) => (
                  <div
                    key={s.id}
                    style={{
                      background: G.card,
                      border: `1px solid ${G.border}`,
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          Truck #{s.header?.truckNo || '—'}
                        </div>
                        <div
                          style={{ fontSize: 11, color: G.muted, marginTop: 3 }}
                        >
                          {s.header?.startDate} → {s.header?.endDate}
                        </div>
                        <div style={{ fontSize: 11, color: G.muted }}>
                          {s.trips?.length || 0} leg(s) ·{' '}
                          {s.expenses?.length || 0} expense(s)
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 10, color: G.gold }}>
                          {s.createdAt}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={(e) => openEdit(s, e)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${G.gold}`,
                              color: G.gold,
                              borderRadius: 7,
                              padding: '7px 14px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                          >
                            ✏️ EDIT
                          </button>
                          <button
                            onClick={(e) => openPDF(s, e)}
                            style={{
                              background: G.gold,
                              border: 'none',
                              color: G.onGold,
                              borderRadius: 7,
                              padding: '7px 14px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontFamily: FONT_MONO,
                            }}
                          >
                            👁 PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'docs' && (
            <div style={{ padding: '14px 14px 30px' }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: G.muted,
                  marginBottom: 14,
                }}
              >
                MY DOCUMENTS
              </div>
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
                📎 Upload your documents. Your employer can view these in your
                driver profile.
              </div>
              {DRIVER_DOC_TYPES.map((dt) => {
                const doc = myDocs.find((d: any) => d.type === dt.id);
                return (
                  <div
                    key={dt.id}
                    style={{
                      background: G.card,
                      border: `1px solid ${
                        doc
                          ? G.success + '55'
                          : dt.required
                            ? G.danger + '44'
                            : G.border
                      }`,
                      borderRadius: 10,
                      padding: '12px 16px',
                      marginBottom: 8,
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{dt.icon}</span>
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: G.text,
                            }}
                          >
                            {dt.label}
                            {dt.required && (
                              <span style={{ color: G.danger }}> *</span>
                            )}
                          </div>
                          {doc ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: G.success,
                                marginTop: 1,
                              }}
                            >
                              ✓ {doc.fileName}
                              {doc.expiryDate
                                ? ` · Exp: ${doc.expiryDate}`
                                : ''}
                            </div>
                          ) : (
                            <div
                              style={{
                                fontSize: 10,
                                color: dt.required ? G.danger : G.muted,
                                marginTop: 1,
                              }}
                            >
                              {dt.required
                                ? 'Required — not uploaded'
                                : 'Not uploaded'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {doc && (
                          <button
                            onClick={() => setViewDoc(doc)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${G.gold}`,
                              color: G.gold,
                              borderRadius: 6,
                              padding: '6px 12px',
                              fontSize: 11,
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            👁 VIEW
                          </button>
                        )}
                        <button
                          onClick={() => setUploadModal(dt)}
                          style={{
                            background: doc ? G.card2 : G.gold,
                            color: doc ? '#aaa' : '#000',
                            border: doc ? `1px solid ${G.border2}` : 'none',
                            borderRadius: 7,
                            padding: '7px 14px',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {doc ? '↑ REPLACE' : '↑ UPLOAD'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {uploadModal && (
                <DocUploadModal
                  docType={uploadModal}
                  onUpload={(id: string, fd: any) => {
                    void saveDoc(id, fd);
                    setUploadModal(null);
                  }}
                  onClose={() => setUploadModal(null)}
                />
              )}
              {viewDoc && (
                <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />
              )}
            </div>
          )}

          {tab === 'contract' && (
            <div style={{ padding: '14px 14px 30px' }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: G.muted,
                  marginBottom: 14,
                }}
              >
                MY CONTRACT
              </div>
              {myContract ? (
                <>
                  <div
                    style={{
                      background: G.card,
                      border: `1px solid ${
                        myContract.signedByDriver
                          ? G.success + '66'
                          : G.gold + '44'
                      }`,
                      borderRadius: 12,
                      padding: 18,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: 2,
                        color: G.gold,
                        marginBottom: 14,
                      }}
                    >
                      TERMS FROM {company.name.toUpperCase()}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      {[
                        [
                          'Pay Structure',
                          PAY_TYPES.find((p) => p.id === myContract.payType)
                            ?.label || '—',
                        ],
                        [
                          'Base Rate',
                          `${myContract.payUnit || 'CAD'} ${myContract.payRate || '—'} ${
                            PAY_TYPES.find((p) => p.id === myContract.payType)
                              ?.unit || ''
                          }`,
                        ],
                        [
                          'Detention',
                          myContract.detentionRate
                            ? `${myContract.payUnit} ${myContract.detentionRate}/hr after 2hrs`
                            : '—',
                        ],
                        [
                          'Wait Time',
                          myContract.waitRate
                            ? `${myContract.payUnit} ${myContract.waitRate}/hr`
                            : '—',
                        ],
                        ['Vacation Pay', `${myContract.vacationPct || 4}%`],
                        ['Probation', `${myContract.trialDays || 90} days`],
                      ].map(([k, v]) => (
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
                              color: G.muted,
                              letterSpacing: 2,
                              textTransform: 'uppercase',
                            }}
                          >
                            {k}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
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
                    {myContract.benefits && (
                      <div
                        style={{
                          fontSize: 11,
                          color: G.muted,
                          marginBottom: 6,
                        }}
                      >
                        Benefits: {myContract.benefits}
                      </div>
                    )}
                    {myContract.notes && (
                      <div style={{ fontSize: 11, color: G.muted }}>
                        Notes: {myContract.notes}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      background: G.inset,
                      border: `1px solid ${G.border}`,
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 14,
                      fontSize: 11,
                      color: G.muted,
                      lineHeight: 1.8,
                    }}
                  >
                    <div
                      style={{
                        color: G.text,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      STANDARD TERMS
                    </div>
                    I agree to operate all vehicles safely per
                    federal/provincial regulations including HOS, ELD, and
                    border requirements. I will maintain a valid Class 1 licence
                    and report all incidents within 24hrs.
                  </div>
                  <div
                    onClick={() => {
                      void signContract();
                    }}
                    style={{
                      background: myContract.signedByDriver
                        ? `${G.success}22`
                        : G.card2,
                      border: `2px solid ${
                        myContract.signedByDriver ? G.success : G.border2
                      }`,
                      borderRadius: 12,
                      padding: 18,
                      cursor: myContract.signedByDriver
                        ? 'default'
                        : 'pointer',
                      textAlign: 'center',
                      marginBottom: 14,
                      transition: 'all .2s',
                    }}
                  >
                    {myContract.signedByDriver ? (
                      <>
                        <div style={{ fontSize: 28 }}>✅</div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: G.success,
                            marginTop: 6,
                          }}
                        >
                          SIGNED BY YOU
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: G.muted,
                            marginTop: 4,
                          }}
                        >
                          Signed on {myContract.driverSignedAt}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 28 }}>✍️</div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: G.muted,
                            marginTop: 6,
                          }}
                        >
                          TAP TO SIGN CONTRACT
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: G.muted,
                            marginTop: 4,
                          }}
                        >
                          Your employer has signed · Review terms above before
                          signing
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: G.card,
                      border: `1px solid ${G.border}`,
                      borderRadius: 10,
                      padding: '12px 16px',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🏢</span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: G.text,
                        }}
                      >
                        {company.name}
                      </div>
                      <div style={{ fontSize: 11, color: G.success }}>
                        ✓ Signed by employer on {myContract.updatedAt}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    background: G.card,
                    border: `1px solid ${G.border}`,
                    borderRadius: 12,
                    padding: 50,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <div style={{ color: G.muted, fontSize: 13 }}>
                    No contract set yet.
                  </div>
                  <div
                    style={{ color: G.muted, fontSize: 11, marginTop: 6 }}
                  >
                    Your employer will set your wage and contract terms. Check
                    back soon.
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'status' && (
            <div>
              {myLoad ? (
                <Card>
                  <SectionTitle>ACTIVE LOAD</SectionTitle>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 16,
                    }}
                  >
                    {[
                      ['Load ID', myLoad.id],
                      ['Trip No.', myLoad.tripNo || '—'],
                      ['Truck', myLoad.truckNo || '—'],
                      ['Trailer', myLoad.trailerNo || '—'],
                      ['From', myLoad.origin],
                      ['To', myLoad.destination],
                      ['Pickup', myLoad.pickupTime || '—'],
                      [
                        'Speed',
                        myLoad.status === 'in_transit'
                          ? `${myLoad.speed} km/h`
                          : '—',
                      ],
                    ].map(([k, v]) => (
                      <div key={k}>
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
                          style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}
                        >
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Pill
                      color={
                        myLoad.status === 'in_transit' ? G.gold : G.info
                      }
                    >
                      {myLoad.status.replace('_', ' ').toUpperCase()}
                    </Pill>
                  </div>
                </Card>
              ) : (
                <Card style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 40 }}>🚛</div>
                  <div style={{ color: G.muted, marginTop: 12 }}>
                    No active load assigned to you right now.
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
