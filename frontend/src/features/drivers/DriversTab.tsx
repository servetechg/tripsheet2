import { useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, SectionTitle, G2, Icons, StatsGrid } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { ErrBox } from '@/components/feedback/ErrBox';
import { notify } from '@/components/feedback/Toast';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { invitesApi, authApi, driversApi } from '@/lib/api';
import { DriverProfile } from './DriverProfile';

export function DriversTab({
  company,
  drivers,
  setUsers,
  users,
  loads,
  sheets,
  driverDocs,
  setDriverDocs,
  invites,
  setInvites,
  apiEnabled,
  refreshAll,
}: any) {
  const [view, setView] = useState('list');
  const [selectedDriver, setSD] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [editDriver, setEditDriver] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const createInvite = async () => {
    try {
      if (apiEnabled) {
        const invite = await invitesApi.create(company.id);
        const token = invite.token;
        const base = window.location.href.split('?')[0];
        setGeneratedLink(`${base}?invite=${token}`);
        await refreshAll?.();
      } else {
        const token = uid() + uid();
        const invite = {
          id: uid(),
          token,
          companyId: company.id,
          status: 'pending',
          createdAt: new Date().toLocaleDateString('en-CA'),
        };
        setInvites((p: any[]) => [...p, invite]);
        const base = window.location.href.split('?')[0];
        setGeneratedLink(`${base}?invite=${token}`);
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to create invite', 'error');
    }
  };

  const myInvites = (invites || []).filter(
    (i: any) => i.companyId === company.id,
  );
  const pendingInvites = myInvites.filter((i: any) => i.status === 'pending');
  const completedInvites = myInvites.filter(
    (i: any) => i.status === 'completed',
  );
  const [f, setF] = useState({
    name: '',
    email: '',
    password: '',
    licenseNo: '',
    phone: '',
    dob: '',
    sin: '',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    citizenship: 'CA',
    fastCard: '',
    notes: '',
  });
  const [err, setErr] = useState('');

  const resetForm = () => {
    setF({
      name: '',
      email: '',
      password: '',
      licenseNo: '',
      phone: '',
      dob: '',
      sin: '',
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      citizenship: 'CA',
      fastCard: '',
      notes: '',
    });
    setEditDriver(null);
    setShow(false);
    setErr('');
  };

  const openEditDriver = (d: any) => {
    setF({
      name: d.name || '',
      email: d.email || '',
      password: d.password || '',
      licenseNo: d.licenseNo || '',
      phone: d.phone || '',
      dob: d.dob || '',
      sin: d.sin || '',
      address: d.address || '',
      emergencyName: d.emergencyName || '',
      emergencyPhone: d.emergencyPhone || '',
      citizenship: d.citizenship || 'CA',
      fastCard: d.fastCard || '',
      notes: d.notes || '',
    });
    setEditDriver(d);
    setShow(true);
  };

  const save = async () => {
    if (blank(f.name) || blank(f.email) || (!editDriver && blank(f.password))) {
      setErr(
        editDriver
          ? 'Name and email required.'
          : 'Name, email and password required.',
      );
      return;
    }
    try {
      setBusy(true);
      if (apiEnabled) {
        if (editDriver) {
          const recordId = editDriver.driverRecordId;
          if (recordId) {
            await driversApi.update(recordId, {
              name: f.name.trim(),
              email: f.email.trim().toLowerCase(),
              phone: f.phone,
              dob: f.dob,
              licenseNo: f.licenseNo,
              citizenship: f.citizenship,
              address: f.address,
              emergencyName: f.emergencyName,
              emergencyPhone: f.emergencyPhone,
              fastCard: f.fastCard,
              notes: f.notes,
              sin: f.sin,
            });
          }
          if (editDriver.id) {
            const patch: Record<string, unknown> = { name: f.name.trim() };
            if (f.password) patch.password = f.password.trim();
            try {
              await authApi.updateUser(editDriver.id, patch);
            } catch {
              // auth user may not exist for all drivers
            }
          }
        } else {
          if (
            users.find(
              (u: any) =>
                u.email.toLowerCase() === f.email.trim().toLowerCase(),
            )
          ) {
            setErr('Email already in use.');
            return;
          }
          const user = await authApi.createUser({
            email: f.email.trim().toLowerCase(),
            password: f.password.trim(),
            name: f.name.trim(),
            role: 'driver',
            companyId: company.id,
          });
          await driversApi.create({
            companyId: company.id,
            userId: user.id,
            name: f.name.trim(),
            email: f.email.trim().toLowerCase(),
            phone: f.phone,
            dob: f.dob,
            licenseNo: f.licenseNo,
            citizenship: f.citizenship,
            address: f.address,
            emergencyName: f.emergencyName,
            emergencyPhone: f.emergencyPhone,
            fastCard: f.fastCard,
            notes: f.notes,
            sin: f.sin,
          });
        }
        await refreshAll?.();
      } else if (editDriver) {
        setUsers((p: any[]) =>
          p.map((u) => (u.id === editDriver.id ? { ...u, ...f } : u)),
        );
      } else {
        if (
          users.find(
            (u: any) => u.email.toLowerCase() === f.email.trim().toLowerCase(),
          )
        ) {
          setErr('Email already in use.');
          return;
        }
        setUsers((p: any[]) => [
          ...p,
          { ...f, id: uid(), role: 'driver', companyId: company.id },
        ]);
      }
      resetForm();
    } catch (e: any) {
      setErr(e?.message || 'Failed to save driver');
    } finally {
      setBusy(false);
    }
  };

  const removeDriver = async (d: any) => {
    if (!window.confirm(`Remove ${d.name}?`)) return;
    try {
      if (apiEnabled) {
        const recordId = d.driverRecordId;
        if (recordId) {
          await driversApi.remove(recordId);
        } else {
          const list = await driversApi.list(company.id);
          const match = (list as any[]).find(
            (x) => x.userId === d.id || x.email === d.email,
          );
          if (match) await driversApi.remove(match.id);
        }
        await refreshAll?.();
      } else {
        setUsers((p: any[]) => p.filter((u) => u.id !== d.id));
      }
      notify(`${d.name} removed.`);
    } catch (e: any) {
      notify(e?.message || 'Remove failed', 'error');
    }
  };

  if (view === 'profile' && selectedDriver) {
    return (
      <DriverProfile
        driver={selectedDriver}
        company={company}
        loads={loads}
        sheets={sheets}
        driverDocs={driverDocs}
        setDriverDocs={setDriverDocs}
        onEdit={() => openEditDriver(selectedDriver)}
        onBack={() => {
          setView('list');
          setSD(null);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: G.text }}>Drivers</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
          Manage roster, invites, and driver readiness.
        </div>
      </div>

      <StatsGrid
        items={[
          {
            label: 'Total Drivers',
            value: drivers.length,
            accent: G.primary,
            icon: Icons.people({ size: 20 }),
          },
          {
            label: 'On Trip',
            value: loads.filter((l: any) =>
              ['assigned', 'in_transit'].includes(l.status),
            ).length,
            accent: G.warning || G.gold,
            icon: Icons.truck({ size: 20 }),
          },
          {
            label: 'Pending Invites',
            value: pendingInvites.length,
            accent: G.info,
            icon: Icons.schedule({ size: 20 }),
          },
          {
            label: 'Completed Invites',
            value: completedInvites.length,
            accent: G.success,
            icon: Icons.checkCircle({ size: 20 }),
          },
        ]}
      />

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
        <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
          Roster ({drivers.length})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            variant="ghost"
            onClick={createInvite}
            style={{
              fontSize: 13,
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            {Icons.add({ size: 16 })}
            Send Invite Link
          </Btn>
          <Btn
            onClick={() => {
              resetForm();
              setShow(true);
            }}
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >
            Add Manually
          </Btn>
        </div>
      </div>

      {generatedLink && (
        <div
          style={{
            background: G.infoTint,
            border: `1px solid ${G.info}44`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.info,
              marginBottom: 8,
            }}
          >
            ✓ INVITE LINK GENERATED — Share with driver
          </div>
          <div
            style={{
              background: G.strip,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 11,
                color: G.gold,
                wordBreak: 'break-all',
                fontFamily: 'monospace',
              }}
            >
              {generatedLink}
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(generatedLink);
              }}
              style={{
                background: G.gold,
                color: G.onGold,
                border: 'none',
                borderRadius: 6,
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📋 COPY
            </button>
          </div>
          <div style={{ fontSize: 11, color: G.muted }}>
            Driver opens this link → fills profile → uploads documents → signs
            contract → you see completed profile here.
          </div>
          <button
            onClick={() => setGeneratedLink(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: G.muted,
              fontSize: 11,
              cursor: 'pointer',
              marginTop: 6,
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {completedInvites.length > 0 && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.success}33`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.success,
              marginBottom: 6,
            }}
          >
            ✓ COMPLETED ONBOARDINGS ({completedInvites.length})
          </div>
          <div style={{ fontSize: 11, color: G.muted }}>
            {completedInvites.map((inv: any) => {
              const d = users.find((u: any) => u.id === inv.driverId);
              return (
                <div
                  key={inv.id}
                  style={{
                    paddingTop: 6,
                    marginTop: 6,
                    borderTop: `1px solid ${G.border}`,
                  }}
                >
                  ✓ {d?.name || 'Driver'} joined on {inv.completedAt}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.gold}33`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.gold,
              marginBottom: 10,
            }}
          >
            ⏳ PENDING INVITES ({pendingInvites.length})
          </div>
          {pendingInvites.map((inv: any) => {
            const link = `${window.location.href.split('?')[0]}?invite=${inv.token}`;
            return (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  borderTop: `1px solid ${G.border}`,
                  paddingTop: 8,
                  marginTop: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    Sent: {inv.createdAt}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: G.muted,
                      fontFamily: 'monospace',
                    }}
                  >
                    {link.slice(0, 50)}...
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(link);
                      setGeneratedLink(link);
                    }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${G.gold}`,
                      color: G.gold,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    📋 COPY
                  </button>
                  <button
                    onClick={() =>
                      setInvites((p: any[]) =>
                        p.filter((i) => i.id !== inv.id),
                      )
                    }
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <Card>
          <SectionTitle>
            {editDriver ? 'EDIT DRIVER' : 'NEW DRIVER ACCOUNT'}
          </SectionTitle>
          <ErrBox msg={err} />
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.info,
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: `1px solid ${G.border}`,
            }}
          >
            LOGIN & IDENTITY
          </div>
          <G2 cols={2}>
            <Inp
              label="Full Name *"
              value={f.name}
              onChange={(e: any) =>
                setF((x) => ({ ...x, name: e.target.value }))
              }
              placeholder="Driver full name"
            />
            <Inp
              label="Email *"
              value={f.email}
              onChange={(e: any) =>
                setF((x) => ({ ...x, email: e.target.value }))
              }
              placeholder="driver@company.com"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label={editDriver ? 'Password' : 'Password *'}
              value={f.password}
              onChange={(e: any) =>
                setF((x) => ({ ...x, password: e.target.value }))
              }
              placeholder={
                editDriver ? 'Leave blank to keep' : 'Login password'
              }
              type="password"
            />
            <Inp
              label="Phone"
              value={f.phone}
              onChange={(e: any) =>
                setF((x) => ({ ...x, phone: e.target.value }))
              }
              placeholder="+1 (403) 000-0000"
            />
          </G2>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.gold,
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: `1px solid ${G.border}`,
            }}
          >
            PERSONAL DETAILS
          </div>
          <G2 cols={2}>
            <Inp
              label="Date of Birth"
              value={f.dob}
              onChange={(e: any) =>
                setF((x) => ({ ...x, dob: e.target.value }))
              }
              placeholder="YYYY-MM-DD"
              type="date"
            />
            <Sel
              label="Citizenship"
              value={f.citizenship}
              onChange={(e: any) =>
                setF((x) => ({ ...x, citizenship: e.target.value }))
              }
            >
              {['CA', 'US', 'IN', 'MX', 'Other'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Sel>
          </G2>
          <G2 cols={2}>
            <Inp
              label="License No."
              value={f.licenseNo}
              onChange={(e: any) =>
                setF((x) => ({ ...x, licenseNo: e.target.value }))
              }
              placeholder="e.g. AB-123456"
            />
            <Inp
              label="FAST Card #"
              value={f.fastCard}
              onChange={(e: any) =>
                setF((x) => ({ ...x, fastCard: e.target.value }))
              }
              placeholder="Optional"
            />
          </G2>
          <Inp
            label="Home Address"
            value={f.address}
            onChange={(e: any) =>
              setF((x) => ({ ...x, address: e.target.value }))
            }
            placeholder="Full address"
          />
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              color: G.muted,
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: `1px solid ${G.border}`,
            }}
          >
            EMERGENCY CONTACT
          </div>
          <G2 cols={2}>
            <Inp
              label="Emergency Contact Name"
              value={f.emergencyName}
              onChange={(e: any) =>
                setF((x) => ({ ...x, emergencyName: e.target.value }))
              }
              placeholder="Full name"
            />
            <Inp
              label="Emergency Contact Phone"
              value={f.emergencyPhone}
              onChange={(e: any) =>
                setF((x) => ({ ...x, emergencyPhone: e.target.value }))
              }
              placeholder="+1 (403) 000-0000"
            />
          </G2>
          <Inp
            label="Notes"
            value={f.notes}
            onChange={(e: any) =>
              setF((x) => ({ ...x, notes: e.target.value }))
            }
            placeholder="Any additional notes..."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={save} style={{ opacity: busy ? 0.6 : 1 }}>
              {busy
                ? 'SAVING…'
                : editDriver
                  ? 'SAVE CHANGES'
                  : 'CREATE DRIVER'}
            </Btn>
            <Btn variant="outline" onClick={resetForm}>
              CANCEL
            </Btn>
          </div>
        </Card>
      )}

      {drivers.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div style={{ fontSize: 36 }}>👤</div>
          <div style={{ color: G.muted, marginTop: 10 }}>No drivers yet.</div>
        </Card>
      ) : (
        drivers.map((d: any) => {
          const active = loads.find(
            (l: any) => l.driverId === d.id && l.status === 'in_transit',
          );
          const sc = sheets.filter((s: any) => s.driverId === d.id).length;
          const myDocs = (driverDocs || []).filter(
            (doc: any) => doc.driverId === d.id,
          );
          const missing = DRIVER_DOC_TYPES.filter(
            (t) =>
              t.required &&
              !myDocs.find(
                (doc: any) => doc.type === t.id && doc.status !== 'expired',
              ),
          ).length;
          const expiring = myDocs.filter(
            (doc: any) => doc.status === 'expiring_soon',
          ).length;
          return (
            <Card
              key={d.id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSD(d);
                setView('profile');
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: `${G.gold}22`,
                        border: `2px solid ${G.gold}44`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      👤
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: G.text,
                        }}
                      >
                        {d.name}
                      </div>
                      <div style={{ fontSize: 11, color: G.muted }}>
                        {d.email}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 6,
                    }}
                  >
                    <Pill color={active ? G.gold : G.success}>
                      {active ? 'IN TRANSIT' : 'AVAILABLE'}
                    </Pill>
                    {d.citizenship && (
                      <Pill color={G.muted}>{d.citizenship}</Pill>
                    )}
                    {d.licenseNo && (
                      <span style={{ fontSize: 11, color: G.muted }}>
                        🪪 {d.licenseNo}
                      </span>
                    )}
                    {d.phone && (
                      <span style={{ fontSize: 11, color: G.muted }}>
                        📞 {d.phone}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      marginTop: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 11, color: G.muted }}>
                      📋 {sc} sheet{sc !== 1 ? 's' : ''}
                    </span>
                    {missing > 0 ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.danger,
                          fontWeight: 700,
                        }}
                      >
                        ⛔ {missing} required doc{missing !== 1 ? 's' : ''}{' '}
                        missing — cannot dispatch
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: G.success }}>
                        ✅ Dispatch-ready
                      </span>
                    )}
                    {expiring > 0 && (
                      <span style={{ fontSize: 11, color: G.gold }}>
                        ⏰ {expiring} expiring soon
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    style={{ fontSize: 10, color: G.gold, letterSpacing: 1 }}
                  >
                    VIEW PROFILE →
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDriver(d);
                        setShow(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${G.gold}`,
                        color: G.gold,
                        borderRadius: 7,
                        padding: '6px 12px',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      ✏️ EDIT
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeDriver(d);
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${G.danger}`,
                        color: G.danger,
                        borderRadius: 7,
                        padding: '6px 12px',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
