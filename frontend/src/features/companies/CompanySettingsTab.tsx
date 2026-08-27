import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, G2 } from '@/components/ui';
import { companiesApi, authApi, invitesApi, type CustomRoleDto } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { useCan } from '@/lib/permissions';
import { ROLE_LABELS, isCompanyOwnerRole, isSuperAdminRole } from '@tripsheet/shared';
import { CustomRolesPanel } from './CustomRolesPanel';
import { MasterDataPanel } from './MasterDataPanel';

function LoginHistoryList({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      email: string;
      success: boolean;
      reason: string;
      ip: string;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    void authApi
      .loginHistory({ scope: 'company', limit: 40, companyId })
      .then(setRows)
      .catch(() => setRows([]));
  }, [companyId]);

  if (!rows.length) {
    return (
      <div style={{ color: G.muted, fontSize: 13 }}>No login events yet.</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12,
          }}
        >
          <span>
            {r.email} · {r.success ? 'success' : r.reason || 'failed'}
            {r.ip ? ` · ${r.ip}` : ''}
          </span>
          <span style={{ color: G.muted }}>
            {new Date(r.createdAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function SecurityEventsList({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      type: string;
      severity: string;
      message: string;
      ip: string;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    void authApi
      .securityEvents({ scope: 'company', limit: 30, companyId })
      .then(setRows)
      .catch(() => setRows([]));
  }, [companyId]);

  if (!rows.length) {
    return (
      <div style={{ color: G.muted, fontSize: 13 }}>
        No security events yet. Logins, password changes, lockouts, role
        changes, MFA disable, and invite acceptance are recorded here and
        queued as email notifications when the notification service is
        configured.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12,
          }}
        >
          <span>
            <span
              style={{
                color: r.severity === 'warning' ? G.danger : G.muted,
              }}
            >
              {r.type.replace('security.', '')}
            </span>
            {' · '}
            {r.message.slice(0, 90)}
            {r.message.length > 90 ? '…' : ''}
            {r.ip ? ` · ${r.ip}` : ''}
          </span>
          <span style={{ color: G.muted, flexShrink: 0 }}>
            {new Date(r.createdAt).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

type Sub =
  | 'profile'
  | 'settings'
  | 'branches'
  | 'departments'
  | 'branding'
  | 'documents'
  | 'apiKeys'
  | 'security'
  | 'notifications'
  | 'plan'
  | 'users'
  | 'roles';

export function CompanySettingsTab({
  company,
  adminUser,
  apiEnabled,
  refreshAll,
  initialSub,
}: {
  company: any;
  adminUser?: any;
  apiEnabled?: boolean;
  refreshAll?: (scope?: string) => Promise<void> | void;
  initialSub?: Sub;
}) {
  const { can } = useCan();
  const confirm = useConfirm();
  const [sub, setSub] = useState<Sub>(initialSub || 'profile');
  const [ent, setEnt] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [security, setSecurity] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [profile, setProfile] = useState({
    name: company.name || '',
    shortName: company.shortName || '',
    tagline: company.tagline || '',
    address: company.address || '',
  });
  const [newBranch, setNewBranch] = useState({ name: '', address: '' });
  const [newDoc, setNewDoc] = useState({ name: '', type: 'policy', fileUrl: '' });
  const [newKeyName, setNewKeyName] = useState('Integration key');
  const [revealedKey, setRevealedKey] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'dispatcher',
  });
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleDto[]>([]);

  const cid = company.id;

  const reloadInvites = () =>
    invitesApi
      .list(cid)
      .then((rows) =>
        setPendingInvites(
          (rows || []).filter(
            (i: any) => i.status === 'pending' || i.status === 'expired',
          ),
        ),
      )
      .catch(() => setPendingInvites([]));

  const reload = async () => {
    if (!apiEnabled || !cid) return;
    try {
      const [e, s, b, br, dep, d, k, sec, r] = await Promise.all([
        companiesApi.entitlements(cid),
        companiesApi.settings(cid),
        companiesApi.branding(cid),
        companiesApi.branches(cid),
        companiesApi.departments(cid),
        companiesApi.documents(cid),
        companiesApi.apiKeys(cid),
        companiesApi.securityPolicy(cid),
        companiesApi.notificationRules(cid),
      ]);
      setEnt(e);
      setSettings(s);
      setBranding(b);
      setBranches(br || []);
      setDepartments(dep || []);
      setDocs(d || []);
      setKeys(k || []);
      setSecurity(sec);
      setRules(r || []);
    } catch (err: any) {
      notify(err?.message || 'Failed to load company config', 'error');
    }
  };

  useEffect(() => {
    void reload();
  }, [cid, apiEnabled]);

  useEffect(() => {
    if ((sub !== 'users' && sub !== 'roles') || !apiEnabled || !cid) return;
    void authApi.listUsers(cid).then(setStaff).catch(() => setStaff([]));
    void reloadInvites();
    void companiesApi
      .listCustomRoles(cid)
      .then(setCustomRoles)
      .catch(() => setCustomRoles([]));
  }, [sub, cid, apiEnabled]);

  const tabs: { id: Sub; label: string }[] = (
    [
      { id: 'profile', label: 'Profile' },
      { id: 'users', label: 'Users' },
      { id: 'roles', label: 'Roles' },
      { id: 'settings', label: 'Settings' },
      { id: 'branches', label: 'Branches' },
      { id: 'masterdata', label: 'Master data' },
      { id: 'departments', label: 'Departments' },
      { id: 'branding', label: 'Branding' },
      { id: 'documents', label: 'Documents' },
      { id: 'apiKeys', label: 'API Keys' },
      { id: 'security', label: 'Security' },
      { id: 'notifications', label: 'Alerts' },
      { id: 'plan', label: 'Plan' },
    ] as { id: Sub; label: string }[]
  ).filter((t) => {
    if (t.id === 'apiKeys') return can('admin.api_keys');
    if (t.id === 'security') return can('admin.security');
    if (t.id === 'users' || t.id === 'roles') return can('users.view');
    if (t.id === 'profile' || t.id === 'settings' || t.id === 'branches')
      return can('company.view') || can('company.edit');
    return can('company.view') || can('admin.settings');
  });

  if (!apiEnabled) {
    return (
      <Card>
        <SectionTitle>Company</SectionTitle>
        <div style={{ color: G.muted, fontSize: 13 }}>
          Connect to the live API to manage company settings.
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => (
          <Btn
            key={t.id}
            size="sm"
            variant={sub === t.id ? undefined : 'outline'}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </Btn>
        ))}
      </div>

      {sub === 'users' && (
        <Card>
          <SectionTitle>Users & roles</SectionTitle>
          <div style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
            Invite staff with a system role. After they join, you can switch
            them to a custom role from the Roles tab. They receive a link
            (queued as an email notification) and only that role&apos;s
            permissions until they sign in again.
          </div>
          {can('users.create') && (
            <>
              <G2 cols={3}>
                <Inp
                  label="Name"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <Inp
                  label="Email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                <Sel
                  label="Role"
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, role: e.target.value }))
                  }
                >
                  {[
                    'dispatcher',
                    'dispatcher_supervisor',
                    'general_manager',
                    'fleet_manager',
                    'safety_manager',
                    'accountant',
                    'hr_manager',
                    'maintenance_coordinator',
                  ].map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
                    </option>
                  ))}
                </Sel>
              </G2>
              <Btn
                style={{ marginTop: 12 }}
                disabled={inviteBusy}
                onClick={() => {
                  if (!inviteForm.email.trim() || !inviteForm.name.trim()) {
                    notify('Name and email are required', 'error');
                    return;
                  }
                  setInviteBusy(true);
                  void invitesApi
                    .create(cid, {
                      kind: 'staff',
                      role: inviteForm.role,
                      email: inviteForm.email.trim(),
                      name: inviteForm.name.trim(),
                    })
                    .then((inv) => {
                      const link = `${window.location.origin}/invite?invite=${encodeURIComponent(inv.token)}`;
                      setInviteLink(link);
                      notify(`Invite created for ${inviteForm.role}`);
                      void refreshAll?.(cid);
                      void reloadInvites();
                      return authApi.listUsers(cid).then(setStaff);
                    })
                    .catch((err: any) =>
                      notify(err?.message || 'Invite failed', 'error'),
                    )
                    .finally(() => setInviteBusy(false));
                }}
              >
                Invite staff
              </Btn>
              {inviteLink && (
                <div style={{ marginTop: 12, fontSize: 12, color: G.muted }}>
                  Share this link: {inviteLink}
                </div>
              )}
            </>
          )}
          {pendingInvites.length > 0 && (
            <>
              <Divider />
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Pending invites
              </div>
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    {inv.email || '—'} · {inv.kind}/{inv.role} · {inv.status}
                    {inv.expiresAt ? (
                      <span style={{ color: G.muted }}>
                        {' '}
                        · expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {can('users.create') && inv.status === 'pending' && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void invitesApi
                            .revoke(inv.id)
                            .then(() => reloadInvites())
                            .then(() => notify('Invite revoked'))
                            .catch((err: any) =>
                              notify(err?.message || 'Revoke failed', 'error'),
                            );
                        }}
                      >
                        Revoke
                      </Btn>
                    )}
                    {can('users.create') && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void invitesApi
                            .regenerate(inv.id)
                            .then((created) => {
                              const link = `${window.location.origin}/invite?invite=${encodeURIComponent(created.token)}`;
                              setInviteLink(link);
                              return reloadInvites();
                            })
                            .then(() => notify('Invite regenerated'))
                            .catch((err: any) =>
                              notify(
                                err?.message || 'Regenerate failed',
                                'error',
                              ),
                            );
                        }}
                      >
                        Resend
                      </Btn>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <Divider />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {staff.map((u) => {
              const locked =
                isCompanyOwnerRole(u.role) || isSuperAdminRole(u.role);
              const value = u.customRoleId
                ? `custom:${u.customRoleId}`
                : `sys:${u.role}`;
              const st = u.status || 'active';
              const canStatus = can('users.suspend') && !isSuperAdminRole(u.role);
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 13,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {u.name} · {u.email}{' '}
                    <Pill
                      small
                      color={
                        st === 'active'
                          ? G.success
                          : st === 'suspended' || st === 'locked'
                            ? G.danger
                            : G.muted
                      }
                    >
                      {st}
                    </Pill>
                    {u.customRoleName ? (
                      <span style={{ color: G.muted }}>
                        {' '}
                        · {u.customRoleName}
                      </span>
                    ) : null}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                  {can('users.assign_role') && !locked ? (
                    <Sel
                      value={value}
                      style={{ marginBottom: 0, minWidth: 220 }}
                      onChange={(e) => {
                        const v = e.target.value;
                        const body = v.startsWith('custom:')
                          ? { customRoleId: v.slice(7) }
                          : { role: v.slice(4), customRoleId: null };
                        void authApi
                          .updateUser(u.id, body)
                          .then(() => authApi.listUsers(cid).then(setStaff))
                          .then(() =>
                            notify(
                              'Role updated. The user must sign in again to refresh permissions.',
                            ),
                          )
                          .catch((err: any) =>
                            notify(err?.message || 'Update failed', 'error'),
                          );
                      }}
                    >
                      <optgroup label="System">
                        {[
                          'dispatcher',
                          'dispatcher_supervisor',
                          'general_manager',
                          'fleet_manager',
                          'safety_manager',
                          'accountant',
                          'hr_manager',
                          'maintenance_coordinator',
                          'driver',
                        ].map((r) => (
                          <option key={r} value={`sys:${r}`}>
                            {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
                          </option>
                        ))}
                      </optgroup>
                      {customRoles.length > 0 && (
                        <optgroup label="Custom">
                          {customRoles.map((r) => (
                            <option key={r.id} value={`custom:${r.id}`}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {u.customRoleId &&
                        !customRoles.some((r) => r.id === u.customRoleId) && (
                          <option value={`custom:${u.customRoleId}`}>
                            {u.customRoleName || 'Removed custom role'}
                          </option>
                        )}
                    </Sel>
                  ) : (
                    <span style={{ color: G.muted }}>
                      {u.customRoleName ||
                        ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ||
                        u.role}
                    </span>
                  )}
                  {canStatus && st === 'active' && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      style={{ marginBottom: 0, fontSize: 12 }}
                      onClick={() => {
                        void authApi
                          .setUserStatus(u.id, 'suspended')
                          .then(() => authApi.listUsers(cid).then(setStaff))
                          .then(() =>
                            notify(
                              'User suspended. Active sessions are revoked.',
                            ),
                          )
                          .catch((err: any) =>
                            notify(err?.message || 'Suspend failed', 'error'),
                          );
                      }}
                    >
                      Suspend
                    </Btn>
                  )}
                  {canStatus && st === 'active' && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      style={{ marginBottom: 0, fontSize: 12 }}
                      onClick={() => {
                        void authApi
                          .setUserStatus(u.id, 'locked')
                          .then(() => authApi.listUsers(cid).then(setStaff))
                          .then(() =>
                            notify(
                              'User locked. Active sessions are revoked.',
                            ),
                          )
                          .catch((err: any) =>
                            notify(err?.message || 'Lock failed', 'error'),
                          );
                      }}
                    >
                      Lock
                    </Btn>
                  )}
                  {canStatus &&
                    (st === 'locked' ||
                      (st === 'active' &&
                        u.lockedUntil &&
                        new Date(u.lockedUntil).getTime() > Date.now())) && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        style={{ marginBottom: 0, fontSize: 12 }}
                        onClick={() => {
                          void authApi
                            .unlockUser(u.id)
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() =>
                              notify(
                                'User unlocked. Temporary lockout cleared.',
                              ),
                            )
                            .catch((err: any) =>
                              notify(
                                err?.message || 'Unlock failed',
                                'error',
                              ),
                            );
                        }}
                      >
                        Unlock
                      </Btn>
                    )}
                  {canStatus &&
                    (st === 'suspended' || st === 'inactive') && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        style={{ marginBottom: 0, fontSize: 12 }}
                        onClick={() => {
                          void authApi
                            .setUserStatus(u.id, 'active')
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() => notify('User reactivated'))
                            .catch((err: any) =>
                              notify(
                                err?.message || 'Reactivate failed',
                                'error',
                              ),
                            );
                        }}
                      >
                        Reactivate
                      </Btn>
                    )}
                  {canStatus && st !== 'archived' && !locked && (
                    <Btn
                      variant="danger"
                      size="sm"
                      style={{ marginBottom: 0, fontSize: 12 }}
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: 'Archive user',
                            message: `Archive ${u.email}? They will not be able to sign in. This is a soft archive (not a permanent delete).`,
                            confirmLabel: 'Archive',
                            variant: 'danger',
                          });
                          if (!ok) return;
                          void authApi
                            .setUserStatus(u.id, 'archived')
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() => notify('User archived'))
                            .catch((err: any) =>
                              notify(err?.message || 'Archive failed', 'error'),
                            );
                        })();
                      }}
                    >
                      Archive
                    </Btn>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {sub === 'roles' && <CustomRolesPanel companyId={cid} />}

      {sub === 'profile' && (
        <Card>
          <SectionTitle>Company profile</SectionTitle>
          <G2 cols={2}>
            <Inp
              label="Legal name"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
            <Inp
              label="Short name"
              value={profile.shortName}
              onChange={(e) =>
                setProfile((p) => ({ ...p, shortName: e.target.value }))
              }
            />
            <Inp
              label="Tagline"
              value={profile.tagline}
              onChange={(e) =>
                setProfile((p) => ({ ...p, tagline: e.target.value }))
              }
            />
            <Inp
              label="Address"
              value={profile.address}
              onChange={(e) =>
                setProfile((p) => ({ ...p, address: e.target.value }))
              }
            />
          </G2>
          <Btn
            onClick={() => {
              void companiesApi
                .update(cid, profile)
                .then(() => {
                  notify('Profile saved');
                  return refreshAll?.('all');
                })
                .catch((err: any) => notify(err?.message || 'Save failed', 'error'));
            }}
          >
            Save profile
          </Btn>
        </Card>
      )}

      {sub === 'settings' && settings && (
        <Card>
          <SectionTitle>Settings packs</SectionTitle>
          <Divider label="General" />
          <G2 cols={3}>
            <Inp
              label="Currency"
              value={settings.general?.currency || ''}
              onChange={(e) =>
                setSettings((s: any) => ({
                  ...s,
                  general: { ...s.general, currency: e.target.value },
                }))
              }
            />
            <Inp
              label="Time zone"
              value={settings.general?.timeZone || ''}
              onChange={(e) =>
                setSettings((s: any) => ({
                  ...s,
                  general: { ...s.general, timeZone: e.target.value },
                }))
              }
            />
            <Inp
              label="Distance unit"
              value={settings.general?.distanceUnit || ''}
              onChange={(e) =>
                setSettings((s: any) => ({
                  ...s,
                  general: { ...s.general, distanceUnit: e.target.value },
                }))
              }
            />
          </G2>
          <Divider label="Dispatch" />
          <G2 cols={2}>
            <label style={{ fontSize: 12, color: G.muted }}>
              <input
                type="checkbox"
                checked={Boolean(settings.dispatch?.autoDispatchNumber)}
                onChange={(e) =>
                  setSettings((s: any) => ({
                    ...s,
                    dispatch: {
                      ...s.dispatch,
                      autoDispatchNumber: e.target.checked,
                    },
                  }))
                }
              />{' '}
              Auto dispatch numbers
            </label>
            <label style={{ fontSize: 12, color: G.muted }}>
              <input
                type="checkbox"
                checked={Boolean(settings.dispatch?.driverAcceptanceRequired)}
                onChange={(e) =>
                  setSettings((s: any) => ({
                    ...s,
                    dispatch: {
                      ...s.dispatch,
                      driverAcceptanceRequired: e.target.checked,
                    },
                  }))
                }
              />{' '}
              Driver acceptance required
            </label>
          </G2>
          <Btn
            style={{ marginTop: 12 }}
            onClick={() => {
              void companiesApi
                .patchSettings(cid, {
                  general: settings.general,
                  dispatch: settings.dispatch,
                  driver: settings.driver,
                  accounting: settings.accounting,
                  maintenance: settings.maintenance,
                  compliance: settings.compliance,
                })
                .then(() => notify('Settings saved'))
                .catch((err: any) =>
                  notify(err?.message || 'Save failed', 'error'),
                );
            }}
          >
            Save settings
          </Btn>
        </Card>
      )}

      {sub === 'branches' && (
        <Card>
          <SectionTitle>Branches / terminals</SectionTitle>
          <G2 cols={3}>
            <Inp
              label="Name"
              value={newBranch.name}
              onChange={(e) =>
                setNewBranch((b) => ({ ...b, name: e.target.value }))
              }
            />
            <Inp
              label="Address"
              value={newBranch.address}
              onChange={(e) =>
                setNewBranch((b) => ({ ...b, address: e.target.value }))
              }
            />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Btn
                onClick={() => {
                  void companiesApi
                    .saveBranch(cid, newBranch)
                    .then(() => {
                      setNewBranch({ name: '', address: '' });
                      return reload();
                    })
                    .catch((err: any) =>
                      notify(err?.message || 'Failed', 'error'),
                    );
                }}
              >
                Add branch
              </Btn>
            </div>
          </G2>
          <div style={{ marginTop: 12 }}>
            {branches.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: `1px solid ${G.border}`,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: G.muted }}>
                    {b.address || '—'} · {b.timeZone} · {b.currency}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill color={b.active ? G.success : G.muted} small>
                    {b.active ? 'active' : 'inactive'}
                  </Pill>
                  {b.active && (
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void companiesApi
                          .deleteBranch(cid, b.id)
                          .then(reload)
                          .catch((err: any) =>
                            notify(err?.message || 'Failed', 'error'),
                          );
                      }}
                    >
                      Deactivate
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sub === 'masterdata' && <MasterDataPanel companyId={cid} />}

      {sub === 'departments' && (
        <Card>
          <SectionTitle>Departments</SectionTitle>
          {departments.map((d) => (
            <div key={d.id} style={{ fontSize: 13, padding: '6px 0' }}>
              <strong>{d.name}</strong>{' '}
              <code style={{ color: G.muted }}>{d.code}</code>
            </div>
          ))}
          <Btn
            size="sm"
            style={{ marginTop: 8 }}
            onClick={() => {
              const name = prompt('Department name');
              if (!name) return;
              void companiesApi
                .saveDepartment(cid, { name, code: name.slice(0, 8) })
                .then(reload)
                .catch((err: any) => notify(err?.message || 'Failed', 'error'));
            }}
          >
            Add department
          </Btn>
        </Card>
      )}

      {sub === 'branding' && branding && (
        <Card>
          <SectionTitle>Branding</SectionTitle>
          <G2 cols={2}>
            <Inp
              label="Logo URL"
              value={branding.logoUrl || ''}
              onChange={(e) =>
                setBranding((b: any) => ({ ...b, logoUrl: e.target.value }))
              }
            />
            <Inp
              label="Accent color"
              value={branding.accentColor || ''}
              onChange={(e) =>
                setBranding((b: any) => ({ ...b, accentColor: e.target.value }))
              }
            />
            <Inp
              label="Primary color"
              value={branding.primaryColor || ''}
              onChange={(e) =>
                setBranding((b: any) => ({ ...b, primaryColor: e.target.value }))
              }
            />
            <Inp
              label="Secondary color"
              value={branding.secondaryColor || ''}
              onChange={(e) =>
                setBranding((b: any) => ({
                  ...b,
                  secondaryColor: e.target.value,
                }))
              }
            />
            <Inp
              label="Invoice header"
              value={branding.invoiceHeader || ''}
              onChange={(e) =>
                setBranding((b: any) => ({
                  ...b,
                  invoiceHeader: e.target.value,
                }))
              }
            />
            <Inp
              label="Invoice footer"
              value={branding.invoiceFooter || ''}
              onChange={(e) =>
                setBranding((b: any) => ({
                  ...b,
                  invoiceFooter: e.target.value,
                }))
              }
            />
          </G2>
          <Btn
            onClick={() => {
              void companiesApi
                .patchBranding(cid, branding)
                .then(() => notify('Branding saved'))
                .catch((err: any) =>
                  notify(err?.message || 'Save failed', 'error'),
                );
            }}
          >
            Save branding
          </Btn>
        </Card>
      )}

      {sub === 'documents' && (
        <Card>
          <SectionTitle>Company document vault</SectionTitle>
          <G2 cols={3}>
            <Inp
              label="Name"
              value={newDoc.name}
              onChange={(e) => setNewDoc((d) => ({ ...d, name: e.target.value }))}
            />
            <Inp
              label="Type"
              value={newDoc.type}
              onChange={(e) => setNewDoc((d) => ({ ...d, type: e.target.value }))}
            />
            <Inp
              label="File URL"
              value={newDoc.fileUrl}
              onChange={(e) =>
                setNewDoc((d) => ({ ...d, fileUrl: e.target.value }))
              }
            />
          </G2>
          <Btn
            onClick={() => {
              void companiesApi
                .createDocument(cid, {
                  ...newDoc,
                  uploadedBy: adminUser?.email || adminUser?.name || '',
                })
                .then(() => {
                  setNewDoc({ name: '', type: 'policy', fileUrl: '' });
                  return reload();
                })
                .catch((err: any) => notify(err?.message || 'Failed', 'error'));
            }}
          >
            Add document
          </Btn>
          <div style={{ marginTop: 12 }}>
            {docs.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: `1px solid ${G.border}`,
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{d.name}</strong> · {d.type}
                  {d.fileUrl ? (
                    <>
                      {' · '}
                      <a href={d.fileUrl} target="_blank" rel="noreferrer">
                        open
                      </a>
                    </>
                  ) : null}
                </div>
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    void companiesApi
                      .deleteDocument(cid, d.id)
                      .then(reload)
                      .catch((err: any) =>
                        notify(err?.message || 'Failed', 'error'),
                      );
                  }}
                >
                  Delete
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sub === 'apiKeys' && (
        <Card>
          <SectionTitle>API keys</SectionTitle>
          {!ent?.features?.apiAccess && (
            <div style={{ color: G.gold, fontSize: 12, marginBottom: 8 }}>
              API access requires Enterprise plan (keys can still be managed for
              prep).
            </div>
          )}
          <G2 cols={2}>
            <Inp
              label="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Btn
                onClick={() => {
                  void companiesApi
                    .createApiKey(cid, { name: newKeyName, scopes: ['read'] })
                    .then((res: any) => {
                      setRevealedKey(res.apiKey || '');
                      notify('API key created — copy it now');
                      return reload();
                    })
                    .catch((err: any) =>
                      notify(err?.message || 'Failed', 'error'),
                    );
                }}
              >
                Create key
              </Btn>
            </div>
          </G2>
          {revealedKey && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                background: G.card2 || '#f5f5f5',
                fontFamily: 'monospace',
                fontSize: 12,
                wordBreak: 'break-all',
              }}
            >
              {revealedKey}
            </div>
          )}
          {keys.map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${G.border}`,
                fontSize: 13,
              }}
            >
              <div>
                {k.name} · <code>{k.keyPrefix}…</code>{' '}
                <Pill color={k.active ? G.success : G.muted} small>
                  {k.active ? 'active' : 'revoked'}
                </Pill>
              </div>
              {k.active && (
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    void companiesApi
                      .revokeApiKey(cid, k.id)
                      .then(reload)
                      .catch((err: any) =>
                        notify(err?.message || 'Failed', 'error'),
                      );
                  }}
                >
                  Revoke
                </Btn>
              )}
            </div>
          ))}
        </Card>
      )}

      {sub === 'security' && security && (
        <Card>
          <SectionTitle>Security policy</SectionTitle>
          <div style={{ color: G.muted, fontSize: 13, marginBottom: 16 }}>
            New and changed passwords follow this policy. Existing logins
            (including seed passwords like admin123) keep working until the
            user changes them. Complexity adds Chapter 4 rules: 12+, upper,
            lower, number, special character, and no name/email. Access JWTs
            are short-lived; refresh tokens last for Session days. Idle
            timeout applies on refresh (server) and optionally in the browser.
            Require MFA enforces TOTP authenticator enrollment at login (User
            menu → Authenticator). SSO / Entra / SAML are not available in this
            release.
          </div>
          <G2 cols={3}>
            <Inp
              label="Min password length"
              value={String(security.passwordMinLength ?? 8)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  passwordMinLength: Number(e.target.value) || 8,
                }))
              }
            />
            <Inp
              label="Password history (0 = off)"
              value={String(security.passwordHistoryCount ?? 10)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  passwordHistoryCount: Number(e.target.value) || 0,
                }))
              }
            />
            <Inp
              label="Session days"
              value={String(security.sessionDays ?? 7)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  sessionDays: Number(e.target.value) || 7,
                }))
              }
            />
            <Inp
              label="Idle timeout (minutes, 0 = off)"
              value={String(security.idleTimeoutMinutes ?? 0)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  idleTimeoutMinutes: Number(e.target.value) || 0,
                }))
              }
            />
            <Inp
              label="Invite link TTL (days)"
              value={String(security.inviteTtlDays ?? 7)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  inviteTtlDays: Number(e.target.value) || 7,
                }))
              }
            />
            <Inp
              label="Lockout after failures"
              value={String(security.lockoutThreshold ?? 5)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  lockoutThreshold: Number(e.target.value) || 5,
                }))
              }
            />
            <Inp
              label="Lockout minutes"
              value={String(security.lockoutMinutes ?? 15)}
              onChange={(e) =>
                setSecurity((s: any) => ({
                  ...s,
                  lockoutMinutes: Number(e.target.value) || 15,
                }))
              }
            />
            <label style={{ fontSize: 12, color: G.muted, paddingTop: 22 }}>
              <input
                type="checkbox"
                checked={Boolean(security.passwordComplexity)}
                onChange={(e) =>
                  setSecurity((s: any) => ({
                    ...s,
                    passwordComplexity: e.target.checked,
                  }))
                }
              />{' '}
              Require complexity (12+ / upper / lower / number / special / no
              name-email)
            </label>
            <label style={{ fontSize: 12, color: G.muted, paddingTop: 22 }}>
              <input
                type="checkbox"
                checked={Boolean(security.requireMfa)}
                onChange={(e) =>
                  setSecurity((s: any) => ({
                    ...s,
                    requireMfa: e.target.checked,
                  }))
                }
              />{' '}
              Require MFA (authenticator at login)
            </label>
          </G2>
          <Btn
            onClick={() => {
              void companiesApi
                .patchSecurityPolicy(cid, security)
                .then(() => notify('Security policy saved'))
                .catch((err: any) =>
                  notify(err?.message || 'Save failed', 'error'),
                );
            }}
          >
            Save policy
          </Btn>
          <Divider />
          <SectionTitle>Login history</SectionTitle>
          <LoginHistoryList companyId={cid} />
          <Divider />
          <SectionTitle>Security events</SectionTitle>
          <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
            Subset of Chapter 4 security hooks (not impossible-travel). Email
            notifications are queued when NOTIFICATION_SERVICE_URL is set.
          </div>
          <SecurityEventsList companyId={cid} />
        </Card>
      )}

      {sub === 'notifications' && (
        <Card>
          <SectionTitle>Admin notification rules</SectionTitle>
          <div style={{ color: G.muted, fontSize: 12, marginBottom: 12 }}>
            Includes security.* rules (login, password, role, MFA, invite,
            lockout) seeded for each company. Delivery remains a queue until
            SMTP is configured.
          </div>
          {rules.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${G.border}`,
                fontSize: 13,
              }}
            >
              <div>
                <strong>{r.eventType}</strong> → {r.channel} / {r.target}
              </div>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(r.enabled)}
                  onChange={(e) => {
                    void companiesApi
                      .saveNotificationRule(cid, {
                        ...r,
                        enabled: e.target.checked,
                      })
                      .then(reload)
                      .catch((err: any) =>
                        notify(err?.message || 'Failed', 'error'),
                      );
                  }}
                />{' '}
                enabled
              </label>
            </div>
          ))}
        </Card>
      )}

      {sub === 'plan' && (
        <Card>
          <SectionTitle>Subscription & entitlements</SectionTitle>
          {ent ? (
            <>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                Plan: <strong>{ent.planName || ent.planCode}</strong> · max
                drivers:{' '}
                {ent.maxDrivers < 0 ? 'unlimited' : ent.maxDrivers} · status:{' '}
                {ent.subscriptionStatus}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(ent.features || {}).map(([k, v]) => (
                  <Pill key={k} color={v ? G.success : G.muted} small>
                    {k}: {v ? 'on' : 'off'}
                  </Pill>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: G.muted }}>Loading…</div>
          )}
        </Card>
      )}
    </div>
  );
}
