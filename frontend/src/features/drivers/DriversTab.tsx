import { useState, useEffect } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, SectionTitle, G2, StatCard, StatsGrid, Icons } from '@/components/ui';
import { blank } from '@/lib/format';
import { uid } from '@/lib/uid';
import { ErrBox } from '@/components/feedback/ErrBox';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { invitesApi, authApi, driversApi, notificationsApi, companiesApi } from '@/lib/api';
import {
  AVAILABILITY_LABELS,
  DRIVER_AVAILABILITY_STATUSES,
  DRIVER_LIFECYCLE_LABELS,
  DRIVER_TYPE_LABELS,
  lifecycleAllowsDispatch,
} from '@/lib/driverLifecycle';
import { AvailabilityBadge } from './DriverProfileChapter6Panels';
import { DriverProfile } from './DriverProfile';
import { matchesDriverRef } from '@/lib/driverIds';
import { useCan } from '@/lib/permissions';

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
  const { can } = useCan();
  const confirm = useConfirm();
  const [view, setView] = useState('list');
  const [selectedDriver, setSD] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [editDriver, setEditDriver] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState<any>(null);
  const [invitePhone, setInvitePhone] = useState('');
  const [busy, setBusy] = useState(false);

  const createInvite = async () => {
    try {
      if (apiEnabled) {
        const invite = await invitesApi.create(company.id);
        const token = invite.token;
        setGeneratedLink(
          `${window.location.origin}/invite?invite=${encodeURIComponent(token)}`,
        );
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
        setGeneratedLink(
          `${window.location.origin}/invite?invite=${encodeURIComponent(token)}`,
        );
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
    driverType: 'company',
    employeeNumber: '',
    hireDate: '',
    branchId: '',
    availabilityStatus: 'available',
  });
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!apiEnabled || !company?.id) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    companiesApi
      .branches(company.id)
      .then((rows) => {
        if (!cancelled) setBranches(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, company?.id]);

  const driverDocsFor = (d: any) =>
    (driverDocs || []).filter((doc: any) => matchesDriverRef(doc.driverId, d));

  const driverCompliance = (d: any) => {
    const myDocs = driverDocsFor(d);
    const today = new Date().toISOString().slice(0, 10);
    const warn = new Date();
    warn.setDate(warn.getDate() + 30);
    const warnStr = warn.toISOString().slice(0, 10);
    const missingRequired = DRIVER_DOC_TYPES.filter(
      (t) =>
        t.required &&
        !myDocs.find((doc: any) => doc.type === t.id && doc.status !== 'expired'),
    ).length;
    const expiringSoon = myDocs.filter((doc: any) => {
      if (doc.status === 'expiring_soon') return true;
      if (doc.expiryDate && doc.expiryDate >= today && doc.expiryDate <= warnStr) {
        return true;
      }
      return doc.status === 'expired';
    }).length;
    const hasFast =
      Boolean(d.fastCard?.trim()) ||
      myDocs.some((doc: any) => doc.type === 'fast_card' && doc.status !== 'expired');
    const hasHazmat = myDocs.some(
      (doc: any) => doc.type === 'hazmat' && doc.status !== 'expired',
    );
    return { missingRequired, expiringSoon, hasFast, hasHazmat };
  };

  const revokeInvite = async (inv: any) => {
    const ok = await confirm({
      title: 'Revoke invite',
      message: 'This link will no longer work. Continue?',
      confirmLabel: 'Revoke',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      if (apiEnabled) {
        await invitesApi.revoke(inv.id);
        await refreshAll?.();
      } else {
        setInvites((p: any[]) =>
          p.map((i) => (i.id === inv.id ? { ...i, status: 'revoked' } : i)),
        );
      }
      notify('Invite revoked');
    } catch (e: any) {
      notify(e?.message || 'Revoke failed', 'error');
    }
  };

  const regenerateInvite = async (inv: any) => {
    try {
      if (apiEnabled) {
        const next = await invitesApi.regenerate(inv.id);
        await refreshAll?.();
        if (next?.token) {
          setGeneratedLink(
            `${window.location.origin}/invite?invite=${encodeURIComponent(next.token)}`,
          );
        }
      } else {
        const token = uid();
        setInvites((p: any[]) =>
          p.map((i) =>
            i.id === inv.id ? { ...i, token, status: 'pending', createdAt: new Date().toLocaleDateString('en-CA') } : i,
          ),
        );
        setGeneratedLink(
          `${window.location.origin}/invite?invite=${encodeURIComponent(token)}`,
        );
      }
      notify('Invite regenerated');
    } catch (e: any) {
      notify(e?.message || 'Regenerate failed', 'error');
    }
  };

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
      driverType: 'company',
      employeeNumber: '',
      hireDate: '',
      branchId: '',
      availabilityStatus: 'available',
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
      driverType: d.driverType || 'company',
      employeeNumber: d.employeeNumber || '',
      hireDate: d.hireDate || '',
      branchId: d.branchId || '',
      availabilityStatus: d.availabilityStatus || 'available',
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
              driverType: f.driverType,
              employeeNumber: f.employeeNumber || undefined,
              hireDate: f.hireDate || undefined,
              branchId: f.branchId || undefined,
              availabilityStatus: f.availabilityStatus || undefined,
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
            lifecycleStatus: 'active',
            driverType: f.driverType,
            employeeNumber: f.employeeNumber || undefined,
            hireDate: f.hireDate || undefined,
            branchId: f.branchId || undefined,
            availabilityStatus: f.availabilityStatus || 'available',
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
    const ok = await confirm({
      title: 'Archive driver',
      message: `Archive ${d.name}? Historical records are retained.`,
      confirmLabel: 'Archive',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      if (apiEnabled) {
        const recordId = d.driverRecordId;
        if (recordId) {
          await driversApi.archive(recordId);
        } else {
          const list = await driversApi.list(company.id);
          const match = (list as any[]).find(
            (x) => x.userId === d.id || x.email === d.email,
          );
          if (match) await driversApi.archive(match.id);
        }
        await refreshAll?.();
      } else {
        setUsers((p: any[]) => p.filter((u) => u.id !== d.id));
      }
      notify(`${d.name} archived.`);
    } catch (e: any) {
      notify(e?.message || 'Archive failed', 'error');
    }
  };

  const approveDriver = async (d: any, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    const recordId = d.driverRecordId;
    if (!recordId || !apiEnabled) return;
    try {
      await driversApi.approve(recordId);
      await refreshAll?.();
      notify(`${d.name} approved — now active for dispatch`);
    } catch (err: any) {
      notify(err?.message || 'Approve failed', 'error');
    }
  };

  const filteredDrivers = drivers.filter((d: any) => {
    const q = searchQ.trim().toLowerCase();
    if (q) {
      const hay = `${d.name} ${d.email} ${d.licenseNo || ''} ${d.employeeNumber || ''} ${d.fastCard || ''} ${d.branchId || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (branchFilter !== 'all' && (d.branchId || '') !== branchFilter) return false;
    const compliance = driverCompliance(d);
    if (docFilter === 'expiring' && compliance.expiringSoon === 0) return false;
    if (docFilter === 'missing_required' && compliance.missingRequired === 0) return false;
    if (docFilter === 'has_fast' && !compliance.hasFast) return false;
    if (docFilter === 'has_hazmat' && !compliance.hasHazmat) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'dispatch_ready') {
      return lifecycleAllowsDispatch(d.lifecycleStatus || 'active');
    }
    return (d.lifecycleStatus || 'active') === statusFilter;
  });

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
        apiEnabled={apiEnabled}
        refreshAll={refreshAll}
      />
    );
  }

  return (
    <div>
      <StatsGrid>
        <StatCard
          label="Drivers"
          value={drivers.length}
          subtitle="Active roster"
          accent={G.info}
          icon={Icons.drivers({ size: 20, color: G.info })}
        />
        <StatCard
          label="In Transit"
          value={drivers.filter((d: any) =>
            loads.some(
              (l: any) =>
                matchesDriverRef(l.driverId, d) && l.status === 'in_transit',
            ),
          ).length}
          subtitle="On duty now"
          accent={G.warning}
          icon={Icons.running({ size: 20, color: G.warning })}
        />
        <StatCard
          label="Pending Invites"
          value={pendingInvites.length}
          subtitle="Awaiting signup"
          accent={G.gold}
          icon={Icons.pending({ size: 20, color: G.gold })}
        />
        <StatCard
          label="Completed Invites"
          value={completedInvites.length}
          subtitle="Onboarded"
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
        />
      </StatsGrid>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
          Driver roster
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('drivers.invite') && (
          <Btn
            variant="ghost"
            onClick={createInvite}
            style={{
              fontSize: 11,
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.link({ size: 16, color: G.muted })}
            SEND INVITE LINK
          </Btn>
          )}
          {can('drivers.create') && (
          <Btn
            onClick={() => {
              resetForm();
              setShow(true);
            }}
          >
            + ADD MANUALLY
          </Btn>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <Inp
            label="Search"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Name, email, licence, FAST, branch…"
          />
        </div>
        <Sel
          label="Branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="all">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Sel>
        <Sel
          label="Compliance"
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value)}
        >
          <option value="all">All drivers</option>
          <option value="expiring">Expiring / expired docs</option>
          <option value="missing_required">Missing required docs</option>
          <option value="has_fast">Has FAST</option>
          <option value="has_hazmat">Has hazmat</option>
        </Sel>
        <Sel
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="dispatch_ready">Dispatch-ready (active)</option>
          <option value="pending_review">Pending HR review</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="terminated">Terminated</option>
        </Sel>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Icons.copy({ size: 16, color: G.onGold })}
              COPY
            </button>
          </div>
          {apiEnabled && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 10,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <Inp
                  label="SMS invite to phone"
                  phone
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="(403) 555-0100"
                />
              </div>
              <Btn
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!invitePhone.trim()) {
                    notify('Enter a phone number', 'error');
                    return;
                  }
                  try {
                    await notificationsApi.sendSms({
                      to: invitePhone.trim(),
                      body: `${company.name || 'TripSheet'}: complete onboarding ${generatedLink}`,
                      companyId: company.id,
                      meta: { type: 'invite' },
                    });
                    notify('Invite SMS queued');
                  } catch (e: any) {
                    notify(e?.message || 'SMS failed', 'error');
                  }
                }}
              >
                Send SMS
              </Btn>
            </div>
          )}
          <div style={{ fontSize: 11, color: G.muted }}>
            Driver opens this link → fills profile → uploads documents → signs
            contract → you see completed profile here.
          </div>
          <button
            onClick={() => {
              setGeneratedLink(null);
              setInvitePhone('');
            }}
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.pending({ size: 14, color: G.gold })}
            PENDING INVITES ({pendingInvites.length})
          </div>
          {pendingInvites.map((inv: any) => {
            const link = `${window.location.origin}/invite?invite=${encodeURIComponent(inv.token)}`;
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.copy({ size: 16, color: G.gold })}
                    COPY
                  </button>
                  <button
                    onClick={() => void regenerateInvite(inv)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${G.info}`,
                      color: G.info,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    REGENERATE
                  </button>
                  <button
                    onClick={() => void revokeInvite(inv)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${G.danger}`,
                      color: G.danger,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.trash({ size: 16, color: G.danger })}
                    REVOKE
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
              phone
              value={f.phone}
              onChange={(e: any) =>
                setF((x) => ({ ...x, phone: e.target.value }))
              }
              placeholder="(403) 555-0100"
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
              phone
              value={f.emergencyPhone}
              onChange={(e: any) =>
                setF((x) => ({ ...x, emergencyPhone: e.target.value }))
              }
              placeholder="(403) 555-0100"
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
            EMPLOYMENT
          </div>
          <G2 cols={2}>
            <Sel
              label="Driver type"
              value={f.driverType}
              onChange={(e: any) =>
                setF((x) => ({ ...x, driverType: e.target.value }))
              }
            >
              {Object.entries(DRIVER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Sel>
            <Inp
              label="Employee #"
              value={f.employeeNumber}
              onChange={(e: any) =>
                setF((x) => ({ ...x, employeeNumber: e.target.value }))
              }
            />
            <Inp
              label="Hire date"
              type="date"
              value={f.hireDate}
              onChange={(e: any) =>
                setF((x) => ({ ...x, hireDate: e.target.value }))
              }
            />
          </G2>
          <Sel
            label="Availability"
            value={f.availabilityStatus}
            onChange={(e: any) =>
              setF((x) => ({ ...x, availabilityStatus: e.target.value }))
            }
          >
            {DRIVER_AVAILABILITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AVAILABILITY_LABELS[s]}
              </option>
            ))}
          </Sel>
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

      {filteredDrivers.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div>{Icons.driver({ size: 36, color: G.muted })}</div>
          <div style={{ color: G.muted, marginTop: 10 }}>
            {drivers.length === 0 ? 'No drivers yet.' : 'No drivers match filters.'}
          </div>
        </Card>
      ) : (
        filteredDrivers.map((d: any) => {
          const lifecycle = d.lifecycleStatus || (d.active === false ? 'suspended' : 'active');
          const lifecycleLabel =
            DRIVER_LIFECYCLE_LABELS[lifecycle as keyof typeof DRIVER_LIFECYCLE_LABELS] ||
            lifecycle;
          const canDispatch = lifecycleAllowsDispatch(lifecycle);
          const active = loads.find(
            (l: any) =>
              matchesDriverRef(l.driverId, d) && l.status === 'in_transit',
          );
          const sc = sheets.filter((s: any) =>
            matchesDriverRef(s.driverId, d),
          ).length;
          const myDocs = (driverDocs || []).filter((doc: any) =>
            matchesDriverRef(doc.driverId, d),
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
              key={d.driverRecordId || d.id}
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
                      }}
                    >
                      {Icons.driver({ size: 20, color: G.gold })}
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
                    {active ? (
                      <Pill color={G.gold}>IN TRANSIT</Pill>
                    ) : (
                      <AvailabilityBadge status={d.availabilityStatus} />
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
                    {d.driverType && d.driverType !== 'company' && (
                      <Pill color={G.info}>
                        {DRIVER_TYPE_LABELS[d.driverType as keyof typeof DRIVER_TYPE_LABELS] || d.driverType}
                      </Pill>
                    )}
                    {d.citizenship && (
                      <Pill color={G.muted}>{d.citizenship}</Pill>
                    )}
                    {d.licenseNo && (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.muted,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {d.licenseNo}
                      </span>
                    )}
                    {d.phone && (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.muted,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {Icons.phone({ size: 14, color: G.muted })}
                        {d.phone}
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
                    <span
                      style={{
                        fontSize: 11,
                        color: G.muted,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {Icons.sheets({ size: 14, color: G.muted })}
                      {sc} sheet{sc !== 1 ? 's' : ''}
                    </span>
                    {missing > 0 ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.danger,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {Icons.alert({ size: 14, color: G.danger })}
                        {missing} required doc{missing !== 1 ? 's' : ''}{' '}
                        missing — cannot dispatch
                      </span>
                    ) : canDispatch ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.success,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {Icons.completed({ size: 14, color: G.success })}
                        Dispatch-ready
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.danger,
                          fontWeight: 700,
                        }}
                      >
                        Not dispatch-eligible ({lifecycleLabel})
                      </span>
                    )}
                    {expiring > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          color: G.gold,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {Icons.pending({ size: 14, color: G.gold })}
                        {expiring} expiring soon
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {can('drivers.approve') &&
                      lifecycle === 'pending_review' && (
                        <button
                          onClick={(e) => void approveDriver(d, e)}
                          style={{
                            background: G.success,
                            border: 'none',
                            color: '#fff',
                            borderRadius: 7,
                            padding: '6px 12px',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          APPROVE
                        </button>
                      )}
                    {can('drivers.suspend') &&
                      lifecycle === 'active' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const recordId = d.driverRecordId;
                            if (!recordId) return;
                            const ok = await confirm({
                              title: 'Suspend driver',
                              message: `Suspend ${d.name}? They will not be able to log in or receive dispatches.`,
                              confirmLabel: 'Suspend',
                              variant: 'danger',
                            });
                            if (!ok) return;
                            try {
                              await driversApi.suspend(recordId);
                              await refreshAll?.();
                              notify(`${d.name} suspended`);
                            } catch (err: any) {
                              notify(err?.message || 'Suspend failed', 'error');
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${G.warning}`,
                            color: G.warning,
                            borderRadius: 7,
                            padding: '6px 12px',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          SUSPEND
                        </button>
                      )}
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {Icons.edit({ size: 16, color: G.gold })}
                      EDIT
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {Icons.trash({ size: 16, color: G.danger })}
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
