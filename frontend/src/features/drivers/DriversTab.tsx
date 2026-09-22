import { useState, useEffect, useMemo } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, G2, StatCard, StatsGrid, Icons, Modal, AddressAutocomplete } from '@/components/ui';
import { blank, humanizeEnum } from '@/lib/format';
import { uid } from '@/lib/uid';
import { ErrBox } from '@/components/feedback/ErrBox';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { invitesApi, authApi, driversApi, companiesApi } from '@/lib/api';
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
import { EmailChangeModal } from '@/components/account/EmailChangeModal';
import { SMS_DISABLED_HINT, useSmsEnabled } from '@/hooks/useSmsEnabled';
import type { DriversTabProps } from '@/features/drivers/types';
import type { BranchDto } from '@/types/dtos';
import type { DriverEditFormState } from '@/types/tabs';
import type { InviteDetailDto } from '@/types/dtos';
import type { Invite } from '@tripsheet/shared';
import { getApiErrorMessage } from '@/lib/format';
import type { AppUser } from '@/types/session';

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
}: DriversTabProps) {
  const { can } = useCan();
  const confirm = useConfirm();
  const { smsEnabled } = useSmsEnabled(Boolean(apiEnabled));
  const [view, setView] = useState('list');
  const [selectedDriver, setSD] = useState<AppUser | null>(null);
  const [show, setShow] = useState(false);
  const [editDriver, setEditDriver] = useState<AppUser | null>(null);
  const [initialF, setInitialF] = useState<DriverEditFormState | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedInviteId, setGeneratedInviteId] = useState<string | null>(
    null,
  );
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState<'email' | 'sms' | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archivedExtra, setArchivedExtra] = useState<AppUser[]>([]);

  const showInviteLink = (invite: Invite | InviteDetailDto) => {
    setGeneratedInviteId(invite?.id ?? null);
    setInviteEmail(
      'email' in invite && invite.email ? String(invite.email) : '',
    );
    setGeneratedLink(
      `${window.location.origin}/invite?invite=${encodeURIComponent(invite.token)}`,
    );
  };

  const createInvite = async () => {
    try {
      if (apiEnabled) {
        const invite = await invitesApi.create(company.id);
        showInviteLink(invite);
        await refreshAll?.();
      } else {
        const invite: Invite = {
          id: uid(),
          token: uid() + uid(),
          companyId: company.id,
          status: 'pending',
          createdAt: new Date().toLocaleDateString('en-CA'),
        };
        setInvites((p) => [...p, invite]);
        showInviteLink(invite);
      }
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Failed to create invite'), 'error');
    }
  };

  /** Server builds the link and dispatches it, so the origin stays correct. */
  const sendInvite = async (channel: 'email' | 'sms') => {
    const to = (channel === 'email' ? inviteEmail : invitePhone).trim();
    if (!to) {
      notify(
        channel === 'email' ? 'Enter an email address' : 'Enter a phone number',
        'error',
      );
      return;
    }
    if (!generatedInviteId) {
      notify('Regenerate this invite before sending', 'error');
      return;
    }
    if (channel === 'email') {
      const emailNorm = to.toLowerCase();
      const existingAccount = (users || []).find(
        (u) =>
          String(u.email || '').toLowerCase() === emailNorm &&
          (u.status || u.lifecycleStatus || 'active') !== 'archived',
      );
      if (existingAccount) {
        notify(
          'This email already has an account or driver profile. Use “Change email” on their record instead of a new invite.',
          'error',
        );
        return;
      }
      const pendingDup = pendingInvites.find(
        (i) =>
          i.status === 'pending' &&
          i.id !== generatedInviteId &&
          String(
            ('email' in i ? i.email : '') || '',
          ).toLowerCase() === emailNorm,
      );
      if (pendingDup) {
        notify(
          'Another pending invite already uses this email. Resend or revoke that invite first.',
          'error',
        );
        return;
      }
    }
    setSending(channel);
    try {
      const res = await invitesApi.send(generatedInviteId, { channel, to });
      if (res.status === 'failed') {
        notify(
          `Provider rejected the ${channel === 'email' ? 'email' : 'SMS'} — check delivery settings`,
          'error',
        );
      } else if (channel === 'email' && res.status === 'queued') {
        notify(
          `Invite logged for ${to} — SMTP is not configured yet`,
        );
      } else {
        notify(`Invite sent to ${to}`);
      }
      await refreshAll?.();
    } catch (e: unknown) {
      notify(
        getApiErrorMessage(e, `Could not send invite by ${channel}`),
        'error',
      );
    } finally {
      setSending(null);
    }
  };

  const myInvites = (invites || []).filter(
    (i) => i.companyId === company.id,
  );
  const pendingInvites = myInvites.filter((i) => i.status === 'pending');
  const completedInvites = myInvites.filter(
    (i) => i.status === 'completed',
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

  useEffect(() => {
    if (!apiEnabled || !includeArchived || !company?.id) {
      setArchivedExtra([]);
      return;
    }
    void driversApi
      .list(company.id, true)
      .then((list) => {
        const extra = (list || [])
          .filter((d) => d.lifecycleStatus === 'archived')
          .map((d) => ({
            id: d.userId || d.id,
            driverRecordId: d.id,
            name: d.name,
            email: d.email,
            role: 'driver',
            companyId: d.companyId,
            lifecycleStatus: d.lifecycleStatus,
            phone: d.phone,
            licenseNo: d.licenseNo,
            branchId: d.branchId,
            availabilityStatus: d.availabilityStatus,
          }));
        setArchivedExtra(extra);
      })
      .catch(() => setArchivedExtra([]));
  }, [apiEnabled, includeArchived, company?.id]);

  const rosterDrivers = useMemo(() => {
    const byKey = new Map<string, AppUser>();
    const put = (d) => {
      const email = String(d.email || '').toLowerCase();
      for (const [k, row] of byKey) {
        if (email && String(row.email || '').toLowerCase() === email) {
          const keepCurrent =
            Boolean(d.driverRecordId) && !row.driverRecordId;
          if (keepCurrent) byKey.delete(k);
          else if (row.driverRecordId && !d.driverRecordId) return;
        }
      }
      byKey.set(String(d.driverRecordId || d.id), d);
    };
    for (const d of drivers) {
      if (!includeArchived && (d.lifecycleStatus || 'active') === 'archived') {
        continue;
      }
      put(d);
    }
    if (includeArchived) {
      for (const d of archivedExtra) put(d);
    }
    return Array.from(byKey.values());
  }, [drivers, archivedExtra, includeArchived]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all');
  const [branches, setBranches] = useState<BranchDto[]>([]);
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

  const driverDocsFor = (d) =>
    (driverDocs || []).filter((doc) => matchesDriverRef(doc.driverId, d));

  const driverCompliance = (d) => {
    const myDocs = driverDocsFor(d);
    const today = new Date().toISOString().slice(0, 10);
    const warn = new Date();
    warn.setDate(warn.getDate() + 30);
    const warnStr = warn.toISOString().slice(0, 10);
    const missingRequired = DRIVER_DOC_TYPES.filter(
      (t) =>
        t.required &&
        !myDocs.find((doc) => doc.type === t.id && doc.status !== 'expired'),
    ).length;
    const expiringSoon = myDocs.filter((doc) => {
      if (doc.status === 'expiring_soon') return true;
      if (doc.expiryDate && doc.expiryDate >= today && doc.expiryDate <= warnStr) {
        return true;
      }
      return doc.status === 'expired';
    }).length;
    const hasFast =
      Boolean(d.fastCard?.trim()) ||
      myDocs.some((doc) => doc.type === 'fast_card' && doc.status !== 'expired');
    const hasHazmat = myDocs.some(
      (doc) => doc.type === 'hazmat' && doc.status !== 'expired',
    );
    return { missingRequired, expiringSoon, hasFast, hasHazmat };
  };

  const revokeInvite = async (inv) => {
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
        setInvites((p) =>
          p.map((i) =>
            i.id === inv.id
              ? ({ ...i, status: 'revoked' } as unknown as Invite)
              : i,
          ),
        );
      }
      notify('Invite revoked');
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Revoke failed'), 'error');
    }
  };

  const regenerateInvite = async (inv) => {
    try {
      if (apiEnabled) {
        const next = await invitesApi.regenerate(inv.id);
        await refreshAll?.();
        if (next?.token) {
          showInviteLink(next);
        }
      } else {
        const token = uid();
        setInvites((p) =>
          p.map((i) =>
            i.id === inv.id ? { ...i, token, status: 'pending', createdAt: new Date().toLocaleDateString('en-CA') } : i,
          ),
        );
        showInviteLink({ ...inv, token });
      }
      notify('Invite regenerated');
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Regenerate failed'), 'error');
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
    setInitialF(null);
    setShow(false);
    setTouched({});
    setErr('');
  };

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (k: string) => {
    setTouched((prev) => ({ ...prev, [k]: true }));
  };

  const validateDriverForm = () => {
    const errs: Record<string, string> = {};
    if (blank(f.name)) errs.name = 'Full name is required';
    if (!editDriver) {
      if (blank(f.email)) {
        errs.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
        errs.email = 'Enter a valid email address';
      }
      if (blank(f.password)) {
        errs.password = 'Password is required';
      } else if (f.password.length < 8) {
        errs.password = 'Password must be at least 8 characters';
      }
    }
    return errs;
  };

  const driverFieldErrors = validateDriverForm();
  const isDriverFormValid = Object.keys(driverFieldErrors).length === 0;

  const openEditDriver = (d) => {
    const init = {
      name: d.name || '',
      email: d.email || '',
      password: '',
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
    };
    setF(init);
    setInitialF(init);
    setEditDriver(d);
    setShow(true);
  };

  const ensureDriverRecordId = async (d): Promise<string | null> => {
    if (d.driverRecordId) return d.driverRecordId;
    if (!apiEnabled) return null;
    try {
      const list = await driversApi.list(company.id).catch(() => []);
      const match = (list).find(
        (x) =>
          x.userId === d.id ||
          (x.email && d.email && x.email.toLowerCase() === d.email.toLowerCase()),
      );
      if (match?.id) return match.id;
      const created = await driversApi.create({
        companyId: company.id,
        userId: d.id,
        name: d.name || 'Driver',
        email: d.email,
        phone: d.phone,
        licenseNo: d.licenseNo,
        active: d.active !== false,
        lifecycleStatus: d.lifecycleStatus || 'active',
        availabilityStatus: d.availabilityStatus || 'available',
      });
      return created?.id || null;
    } catch {
      return null;
    }
  };

  const save = async () => {
    const errs = validateDriverForm();
    if (Object.keys(errs).length > 0) {
      setTouched({ name: true, email: true, password: true });
      setErr(Object.values(errs)[0]);
      return;
    }
    try {
      setBusy(true);
      if (apiEnabled) {
        if (editDriver) {
          const recordId = await ensureDriverRecordId(editDriver);
          if (recordId) {
            await driversApi.update(recordId, {
              name: f.name.trim(),
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
              (u) =>
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
            hireDate: f.hireDate || undefined,
            branchId: f.branchId || undefined,
            availabilityStatus: f.availabilityStatus || 'available',
          });
        }
        await refreshAll?.();
      } else if (editDriver) {
        setUsers((p) =>
          p.map((u) => (u.id === editDriver.id ? { ...u, ...f } : u)),
        );
      } else {
        if (
          users.find(
            (u) => u.email.toLowerCase() === f.email.trim().toLowerCase(),
          )
        ) {
          setErr('Email already in use.');
          return;
        }
        setUsers((p) => [
          ...p,
          { ...f, id: uid(), role: 'driver', companyId: company.id },
        ]);
      }
      resetForm();
      notify(editDriver ? 'Driver profile updated' : 'Driver created successfully');
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Failed to save driver');
      setErr(msg);
      notify(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeDriver = async (d) => {
    const ok = await confirm({
      title: 'Archive driver',
      message: `Archive ${d.name}? Historical records are retained.`,
      confirmLabel: 'Archive',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      if (apiEnabled) {
        const recordId = await ensureDriverRecordId(d);
        if (recordId) {
          await driversApi.archive(recordId);
        }
        if (d.id) {
          await authApi.setUserStatus(d.id, 'archived').catch(() => {});
        }
        await refreshAll?.();
      } else {
        setUsers((p) => p.filter((u) => u.id !== d.id));
      }
      notify(`${d.name} archived.`);
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Archive failed'), 'error');
    }
  };

  const approveDriver = async (
    d: AppUser,
    e?: { stopPropagation?: () => void },
  ) => {
    e?.stopPropagation?.();
    try {
      const recordId = await ensureDriverRecordId(d);
      if (recordId && apiEnabled) {
        await driversApi.approve(recordId);
      }
      if (d.id && apiEnabled) {
        await authApi.setUserStatus(d.id, 'active').catch(() => {});
      }
      if (!apiEnabled) {
        setUsers?.((p) =>
          p.map((u) =>
            u.id === d.id ? { ...u, lifecycleStatus: 'active', active: true } : u,
          ),
        );
      }
      await refreshAll?.();
      notify(`${d.name} approved — now active for dispatch`);
    } catch (err: unknown) {
      notify(getApiErrorMessage(err, 'Approve failed'), 'error');
    }
  };

  const restoreDriver = async (d) => {
    const recordId = d.driverRecordId;
    if (!recordId || !apiEnabled) return;
    try {
      await driversApi.restore(recordId);
      await refreshAll?.();
      notify(`${d.name} restored to active roster.`, 'success');
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Restore failed'), 'error');
    }
  };

  const filteredDrivers = rosterDrivers.filter((d) => {
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

  const isFormDirty = Boolean(
    editDriver
      ? initialF &&
        Object.keys(initialF).some(
          (k) => (f)[k] !== (initialF)[k],
        )
      : !blank(f.name) && !blank(f.email) && !blank(f.password),
  );

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
          value={drivers.filter((d) =>
            loads.some(
              (l) =>
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
          <option value="archived">Archived</option>
        </Sel>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: G.muted,
            marginTop: 22,
          }}
        >
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived in roster
        </label>
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
              border: `1px solid ${G.border}`,
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
                fontSize: 12,
                color: G.mode === 'light' ? G.goldDim : G.gold,
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontWeight: 600,
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
          {apiEnabled && generatedInviteId && (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: G.muted,
                  marginBottom: 6,
                }}
              >
                Send the link directly instead of sharing it manually.
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Inp
                    label="Email invite to"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="driver@example.com"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <Btn
                  size="md"
                  disabled={sending !== null}
                  onClick={() => void sendInvite('email')}
                  style={{
                    height: 42,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 16px',
                  }}
                >
                  {sending === 'email' ? 'Sending…' : 'Send email'}
                </Btn>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Inp
                    label="SMS invite to phone"
                    phone
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="(403) 555-0100"
                    style={{ marginBottom: 0 }}
                    disabled={!smsEnabled}
                  />
                </div>
                <Btn
                  size="md"
                  variant="outline"
                  disabled={sending !== null || !smsEnabled}
                  title={smsEnabled ? undefined : SMS_DISABLED_HINT}
                  onClick={() => void sendInvite('sms')}
                  style={{
                    height: 42,
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 16px',
                  }}
                >
                  {sending === 'sms' ? 'Sending…' : 'Send SMS'}
                </Btn>
              </div>
              {!smsEnabled ? (
                <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
                  {SMS_DISABLED_HINT}
                </div>
              ) : null}
            </div>
          )}
          <div style={{ fontSize: 11, color: G.muted }}>
            Driver opens this link → fills profile → uploads documents → signs
            contract → you see completed profile here.
          </div>
          <button
            onClick={() => {
              setGeneratedLink(null);
              setGeneratedInviteId(null);
              setInvitePhone('');
              setInviteEmail('');
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
            {completedInvites.map((inv) => {
              const d = users.find((u) => u.id === inv.driverId);
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
          {pendingInvites.map((inv) => {
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
                  <div style={{ fontSize: 12, color: G.text, fontWeight: 600 }}>
                    Driver onboarding link
                  </div>
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    Created {inv.createdAt || 'recently'} · Ready to share
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(link);
                      showInviteLink(inv);
                    }}
                    style={{
                      background: G.gold,
                      border: `1px solid ${G.gold}`,
                      color: G.onGold,
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {Icons.copy({ size: 16, color: G.onGold })}
                    COPY LINK
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

      <Modal
        open={show}
        onClose={resetForm}
        title={editDriver ? `Edit Driver — ${editDriver.name || editDriver.email}` : 'New Driver Account'}
        maxWidth={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="outline" onClick={resetForm} disabled={busy}>
              CANCEL
            </Btn>
            <Btn
              onClick={save}
              loading={busy}
              disabled={!isFormDirty || !isDriverFormValid || busy}
              loadingLabel={editDriver ? 'Saving…' : 'Creating…'}
            >
              {editDriver ? 'SAVE CHANGES' : 'CREATE DRIVER'}
            </Btn>
          </div>
        }
      >
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
            onChange={(e) =>
              setF((x) => ({ ...x, name: e.target.value }))
            }
            onBlur={() => markTouched('name')}
            error={touched.name ? driverFieldErrors.name : undefined}
            placeholder="Driver full name"
          />
          {editDriver ? (
            <div>
              <Inp
                label="Email"
                value={f.email}
                disabled
                placeholder="driver@company.com"
              />
              {editDriver.id ? (
                <Btn
                  size="sm"
                  variant="outline"
                  style={{ marginTop: 6 }}
                  onClick={() => setEmailModalOpen(true)}
                >
                  Change email…
                </Btn>
              ) : null}
              {editDriver.pendingEmail ? (
                <div style={{ fontSize: 11, color: G.gold, marginTop: 4 }}>
                  Pending: {editDriver.pendingEmail}
                </div>
              ) : null}
            </div>
          ) : (
            <Inp
              label="Email *"
              value={f.email}
              onChange={(e) =>
                setF((x) => ({ ...x, email: e.target.value }))
              }
              onBlur={() => markTouched('email')}
              error={touched.email ? driverFieldErrors.email : undefined}
              placeholder="driver@company.com"
            />
          )}
        </G2>
        <G2 cols={2}>
          <Inp
            label={editDriver ? 'Password' : 'Password *'}
            value={f.password}
            onChange={(e) =>
              setF((x) => ({ ...x, password: e.target.value }))
            }
            onBlur={() => markTouched('password')}
            error={touched.password ? driverFieldErrors.password : undefined}
            placeholder={
              editDriver ? 'Leave blank to keep' : 'Login password'
            }
            type="password"
          />
          <Inp
            label="Phone"
            phone
            value={f.phone}
            onChange={(e) =>
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
            onChange={(e) =>
              setF((x) => ({ ...x, dob: e.target.value }))
            }
            placeholder="YYYY-MM-DD"
            type="date"
          />
          <Sel
            label="Citizenship"
            value={f.citizenship}
            onChange={(e) =>
              setF((x) => ({ ...x, citizenship: e.target.value }))
            }
          >
            {['CA', 'US'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Sel>
        </G2>
        <G2 cols={2}>
          <Inp
            label="License No."
            value={f.licenseNo}
            onChange={(e) =>
              setF((x) => ({ ...x, licenseNo: e.target.value }))
            }
            placeholder="e.g. AB-123456"
          />
          <Inp
            label="FAST Card #"
            value={f.fastCard}
            onChange={(e) =>
              setF((x) => ({ ...x, fastCard: e.target.value }))
            }
            placeholder="Optional"
          />
        </G2>
        <AddressAutocomplete
          label="Home Address"
          value={f.address}
          onChange={(val) =>
            setF((x) => ({ ...x, address: val }))
          }
          placeholder="Full address (US & Canada)"
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
            onChange={(e) =>
              setF((x) => ({ ...x, emergencyName: e.target.value }))
            }
            placeholder="Full name"
          />
          <Inp
            label="Emergency Contact Phone"
            phone
            value={f.emergencyPhone}
            onChange={(e) =>
              setF((x) => ({ ...x, emergencyPhone: e.target.value }))
            }
            placeholder="(403) 555-0100"
          />
        </G2>
        <Inp
          label="Notes"
          value={f.notes}
          onChange={(e) =>
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
            onChange={(e) =>
              setF((x) => ({ ...x, driverType: e.target.value }))
            }
          >
            {Object.entries(DRIVER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Sel>
          {editDriver?.employeeNumber || f.employeeNumber ? (
            <Inp
              label="Employee #"
              value={f.employeeNumber || editDriver?.employeeNumber || ''}
              readOnly
              disabled
            />
          ) : null}
          <Inp
            label="Hire date"
            type="date"
            value={f.hireDate}
            onChange={(e) =>
              setF((x) => ({ ...x, hireDate: e.target.value }))
            }
          />
        </G2>
        <Sel
          label="Availability"
          value={f.availabilityStatus}
          onChange={(e) =>
            setF((x) => ({ ...x, availabilityStatus: e.target.value }))
          }
        >
          {DRIVER_AVAILABILITY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {AVAILABILITY_LABELS[s]}
            </option>
          ))}
        </Sel>
      </Modal>

      {filteredDrivers.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 50 }}>
          <div>{Icons.driver({ size: 36, color: G.muted })}</div>
          <div style={{ color: G.muted, marginTop: 10 }}>
            {drivers.length === 0 ? 'No drivers yet.' : 'No drivers match filters.'}
          </div>
        </Card>
      ) : (
        filteredDrivers.map((d) => {
          const lifecycle = d.lifecycleStatus || (d.active === false ? 'suspended' : 'active');
          const lifecycleLabel =
            DRIVER_LIFECYCLE_LABELS[lifecycle as keyof typeof DRIVER_LIFECYCLE_LABELS] ||
            humanizeEnum(lifecycle);
          const canDispatch = lifecycleAllowsDispatch(lifecycle);
          const active = loads.find(
            (l) =>
              matchesDriverRef(l.driverId, d) && l.status === 'in_transit',
          );
          const sc = sheets.filter((s) =>
            matchesDriverRef(s.driverId, d),
          ).length;
          const myDocs = (driverDocs || []).filter((doc) =>
            matchesDriverRef(doc.driverId, d),
          );
          const missing = DRIVER_DOC_TYPES.filter(
            (t) =>
              t.required &&
              !myDocs.find(
                (doc) => doc.type === t.id && doc.status !== 'expired',
              ),
          ).length;
          const expiring = myDocs.filter(
            (doc) => doc.status === 'expiring_soon',
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
                    ) : lifecycle === 'suspended' ? null : (
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
                        {DRIVER_TYPE_LABELS[d.driverType as keyof typeof DRIVER_TYPE_LABELS] || humanizeEnum(d.driverType)}
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
                    style={{
                      fontSize: 10,
                      color: G.gold,
                      letterSpacing: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>VIEW PROFILE</span>
                    {Icons.arrowRight({ size: 12, color: 'currentColor' })}
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
                            const ok = await confirm({
                              title: 'Suspend driver',
                              message: `Suspend ${d.name}? They will not be able to log in or receive dispatches.`,
                              confirmLabel: 'Suspend',
                              variant: 'danger',
                            });
                            if (!ok) return;
                            try {
                              const recordId = await ensureDriverRecordId(d);
                              if (recordId && apiEnabled) {
                                await driversApi.suspend(recordId);
                              }
                              if (d.id && apiEnabled) {
                                await authApi.setUserStatus(d.id, 'suspended').catch(() => {});
                              }
                              if (!apiEnabled) {
                                setUsers?.((p) =>
                                  p.map((u) =>
                                    u.id === d.id
                                      ? { ...u, lifecycleStatus: 'suspended', active: false }
                                      : u,
                                  ),
                                );
                              }
                              await refreshAll?.();
                              notify(`${d.name} suspended`);
                            } catch (err: unknown) {
                              notify(getApiErrorMessage(err, 'Suspend failed'), 'error');
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
                    {can('drivers.suspend') &&
                      lifecycle === 'suspended' && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await confirm({
                              title: 'Unsuspend driver',
                              message: `Reactivate ${d.name}? They will be able to log in and be assigned to dispatches.`,
                              confirmLabel: 'Unsuspend',
                            });
                            if (!ok) return;
                            try {
                              const recordId = await ensureDriverRecordId(d);
                              if (recordId && apiEnabled) {
                                await driversApi.unsuspend(recordId);
                              }
                              if (d.id && apiEnabled) {
                                await authApi.setUserStatus(d.id, 'active').catch(() => {});
                              }
                              if (!apiEnabled) {
                                setUsers?.((p) =>
                                  p.map((u) =>
                                    u.id === d.id
                                      ? { ...u, lifecycleStatus: 'active', active: true }
                                      : u,
                                  ),
                                );
                              }
                              await refreshAll?.();
                              notify(`${d.name} unsuspended — now active`);
                            } catch (err: unknown) {
                              notify(getApiErrorMessage(err, 'Unsuspend failed'), 'error');
                            }
                          }}
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
                          UNSUSPEND
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
                    {lifecycle === 'archived' && can('drivers.archive') ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void restoreDriver(d);
                        }}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${G.success}`,
                          color: G.success,
                          borderRadius: 7,
                          padding: '6px 12px',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        RESTORE
                      </button>
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
      {editDriver?.id ? (
        <EmailChangeModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          userId={editDriver.id}
          currentEmail={editDriver.email || f.email}
          pendingEmail={editDriver.pendingEmail}
          onSuccess={() => {
            void refreshAll?.().then(() => {
              setEmailModalOpen(false);
              if (!editDriver?.id || !apiEnabled) return;
              void authApi.listUsers(company.id).then((rows) => {
                const fresh = rows.find((r) => r.id === editDriver.id);
                if (!fresh) return;
                setEditDriver((prev) =>
                  prev
                    ? {
                        ...prev,
                        email: fresh.email,
                        pendingEmail: fresh.pendingEmail ?? null,
                      }
                    : prev,
                );
                setF((prev) => ({ ...prev, email: fresh.email }));
              });
            });
          }}
        />
      ) : null}
    </div>
  );
}
