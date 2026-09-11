import { useState, useMemo } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, Icons, G2, StatsGrid, StatCard } from '@/components/ui';
import { authApi, invitesApi, type CustomRoleDto } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { ROLE_LABELS, isCompanyOwnerRole, isSuperAdminRole } from '@tripsheet/shared';
import { useConfirm, type ConfirmOptions } from '@/context/ConfirmContext';

interface UsersPanelProps {
  cid: string;
  company?: any;
  staff: any[];
  setStaff: React.Dispatch<React.SetStateAction<any[]>>;
  pendingInvites: any[];
  reloadInvites: () => Promise<void> | void;
  customRoles: CustomRoleDto[];
  can: (perm: string) => boolean;
  confirm?: (opts: ConfirmOptions) => Promise<boolean>;
  refreshAll?: (scope?: string) => Promise<void> | void;
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'U';
}

function getAvatarColor(str: string): { bg: string; color: string } {
  const colors = [
    { bg: 'rgba(61, 140, 255, 0.15)', color: '#3D8CFF' },
    { bg: 'rgba(52, 211, 153, 0.15)', color: '#34D399' },
    { bg: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24' },
    { bg: 'rgba(167, 139, 250, 0.15)', color: '#A78BFA' },
    { bg: 'rgba(248, 113, 113, 0.15)', color: '#F87171' },
    { bg: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8' },
    { bg: 'rgba(251, 146, 60, 0.15)', color: '#FB923C' },
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

const SYSTEM_STAFF_ROLES = [
  'dispatcher',
  'dispatcher_supervisor',
  'general_manager',
  'fleet_manager',
  'safety_manager',
  'accountant',
  'hr_manager',
  'maintenance_coordinator',
];

const ALL_ROLES_WITH_DRIVER = [
  ...SYSTEM_STAFF_ROLES,
  'driver',
];

export function UsersPanel({
  cid,
  company: _company,
  staff,
  setStaff,
  pendingInvites,
  reloadInvites,
  customRoles,
  can,
  confirm: propConfirm,
  refreshAll,
}: UsersPanelProps) {
  const contextConfirm = useConfirm();
  const confirm = propConfirm || contextConfirm;
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'dispatcher',
  });
  const [inviteLink, setInviteLink] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const activeStaffCount = useMemo(
    () => staff.filter((u) => (u.status || 'active') === 'active').length,
    [staff],
  );
  const suspendedStaffCount = staff.length - activeStaffCount;

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    let list = staff;

    if (statusFilter === 'active') {
      list = list.filter((u) => (u.status || 'active') === 'active');
    } else if (statusFilter === 'suspended') {
      list = list.filter((u) => {
        const st = u.status || 'active';
        return st === 'suspended' || st === 'locked' || st === 'inactive';
      });
    }

    if (roleFilter !== 'all') {
      list = list.filter((u) => {
        if (roleFilter.startsWith('custom:')) {
          return u.customRoleId === roleFilter.slice(7);
        }
        return u.role === roleFilter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        const customRole = (u.customRoleName || '').toLowerCase();
        const roleLabel = (ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          role.includes(q) ||
          customRole.includes(q) ||
          roleLabel.includes(q)
        );
      });
    }

    return list;
  }, [staff, statusFilter, roleFilter, search]);

  const handleInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) {
      notify('Name and email are required', 'error');
      return;
    }
    setInviteBusy(true);
    try {
      const inv = await invitesApi.create(cid, {
        kind: 'staff',
        role: inviteForm.role,
        email: inviteForm.email.trim(),
        name: inviteForm.name.trim(),
      });
      const link = `${window.location.origin}/invite?invite=${encodeURIComponent(inv.token)}`;
      setInviteLink(link);
      notify(`Invite created for ${inviteForm.role}`, 'success');
      setInviteForm({ name: '', email: '', role: 'dispatcher' });
      void refreshAll?.(cid);
      void reloadInvites();
      const updatedStaff = await authApi.listUsers(cid);
      setStaff(updatedStaff);
    } catch (err: any) {
      notify(err?.message || 'Invite failed', 'error');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInviteLink = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(inviteLink);
      notify('Copied invite link to clipboard');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner & Quick Action */}
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
            {Icons.user({ size: 22, color: G.gold })}
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
              Users & Team Governance
              <Pill color={G.gold} small>
                RBAC ACTIVE
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
              Invite team members with predefined system roles or assign custom fine-grained roles. Members receive an onboarding email link and can be suspended or audited at any time.
            </div>
          </div>
        </div>

        {can('users.create') && (
          <Btn
            size="sm"
            onClick={() => setShowInviteForm((v) => !v)}
            style={{
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 16px',
            }}
          >
            {showInviteForm ? Icons.close({ size: 16, color: '#fff' }) : Icons.plus({ size: 16, color: '#fff' })}
            {showInviteForm ? 'Close Form' : 'Invite Staff Member'}
          </Btn>
        )}
      </div>

      {/* Overview Stats */}
      <StatsGrid columns={4} style={{ marginBottom: 0 }}>
        <StatCard
          label="Total Members"
          value={staff.length}
          subtitle="Registered staff accounts"
          accent={G.gold}
          icon={Icons.user({ size: 20, color: G.gold })}
        />
        <StatCard
          label="Active Accounts"
          value={activeStaffCount}
          subtitle={staff.length > 0 ? `${Math.round((activeStaffCount / staff.length) * 100)}% active` : 'None active'}
          accent={G.success}
          icon={Icons.completed({ size: 20, color: G.success })}
        />
        <StatCard
          label="Pending Invites"
          value={pendingInvites.length}
          subtitle="Awaiting onboarding"
          accent={pendingInvites.length > 0 ? G.warning : G.muted}
          icon={Icons.clock({ size: 20, color: pendingInvites.length > 0 ? G.warning : G.muted })}
        />
        <StatCard
          label="Configured Roles"
          value={8 + customRoles.length}
          subtitle={`${customRoles.length} custom · 8 system`}
          accent={G.purple}
          icon={Icons.assigned({ size: 20, color: G.purple })}
        />
      </StatsGrid>

      {/* Invite Member Card (Collapsible or visible if opened/invited) */}
      {can('users.create') && (showInviteForm || inviteLink) && (
        <Card style={{ border: `1px solid ${G.gold}44` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: RADIUS.sm,
                  background: 'rgba(61, 140, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: G.gold,
                }}
              >
                {Icons.plus({ size: 16, color: G.gold })}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>
                  Invite New Staff Member
                </div>
                <div style={{ fontSize: 12, color: G.muted }}>
                  Dispatches an email link for role-based portal access.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: G.muted,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              {Icons.close({ size: 16 })}
            </button>
          </div>

          <G2 cols={3}>
            <Inp
              label="Full Name *"
              placeholder="e.g. Alex Morgan"
              value={inviteForm.name}
              onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              style={{ marginBottom: 0 }}
            />
            <Inp
              label="Email Address *"
              type="email"
              placeholder="alex@company.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              style={{ marginBottom: 0 }}
            />
            <Sel
              label="System Role *"
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
              style={{ marginBottom: 0 }}
            >
              {SYSTEM_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
                </option>
              ))}
            </Sel>
          </G2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Btn
              disabled={inviteBusy}
              onClick={() => void handleInvite()}
              style={{
                height: 38,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 20px',
              }}
            >
              {Icons.dispatch({ size: 16, color: '#fff' })}
              {inviteBusy ? 'Creating Invite…' : 'Send Member Invitation'}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setShowInviteForm(false);
                setInviteForm({ name: '', email: '', role: 'dispatcher' });
              }}
              style={{ height: 38 }}
            >
              Cancel
            </Btn>
          </div>

          {/* Generated Shareable Invite Link */}
          {inviteLink && (
            <div
              style={{
                marginTop: 16,
                background: G.card2,
                border: `1px solid ${G.border}`,
                borderRadius: RADIUS.md,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', marginBottom: 4 }}>
                  Direct Onboarding Link
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: G.mode === 'light' ? G.goldDim : G.gold,
                    wordBreak: 'break-all',
                  }}
                >
                  {inviteLink}
                </div>
              </div>
              <Btn
                size="sm"
                variant="outline"
                onClick={copyInviteLink}
                style={{
                  height: 34,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {Icons.copy({ size: 14 })}
                Copy Link
              </Btn>
            </div>
          )}
        </Card>
      )}

      {/* Section: Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pending Invitations
              </div>
              <Pill color={G.warning} small>
                {pendingInvites.length} AWAITING
              </Pill>
            </div>
            <div style={{ fontSize: 12, color: G.muted }}>
              Invitations expire after 7 days if not accepted
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingInvites.map((inv) => {
              const expiresDate = inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : null;
              return (
                <div
                  key={inv.id}
                  style={{
                    background: G.card2,
                    border: `1px solid ${G.border}`,
                    borderRadius: RADIUS.md,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = G.border2;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = G.border;
                  }}
                >
                  {/* Left: Invitee details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(251, 191, 36, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: G.warning,
                        flexShrink: 0,
                      }}
                    >
                      {Icons.clock({ size: 18, color: G.warning })}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                          {inv.name ? `${inv.name} (${inv.email})` : inv.email || '—'}
                        </span>
                        <Pill color={G.gold} small>
                          {inv.role.toUpperCase()}
                        </Pill>
                        <Pill color={G.muted} small>
                          {inv.kind.toUpperCase()}
                        </Pill>
                      </div>
                      <div style={{ fontSize: 11, color: G.muted, marginTop: 3 }}>
                        Status: <strong style={{ color: G.warning }}>{inv.status}</strong>
                        {expiresDate ? ` · Expires ${expiresDate}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {can('users.create') && (
                      <Btn
                        size="sm"
                        variant="outline"
                        style={{ height: 32, fontSize: 12 }}
                        onClick={() => {
                          void invitesApi
                            .regenerate(inv.id)
                            .then((created) => {
                              const link = `${window.location.origin}/invite?invite=${encodeURIComponent(created.token)}`;
                              setInviteLink(link);
                              notify('Invite regenerated and copied', 'success');
                              if (navigator.clipboard) {
                                void navigator.clipboard.writeText(link);
                              }
                              return reloadInvites();
                            })
                            .catch((err: any) => notify(err?.message || 'Regenerate failed', 'error'));
                        }}
                      >
                        Resend / Copy
                      </Btn>
                    )}

                    {can('users.create') && inv.status === 'pending' && (
                      <Btn
                        size="sm"
                        variant="ghost"
                        style={{ height: 32, fontSize: 12, color: G.danger }}
                        onClick={() => {
                          void invitesApi
                            .revoke(inv.id)
                            .then(() => reloadInvites())
                            .then(() => notify('Invite revoked'))
                            .catch((err: any) => notify(err?.message || 'Revoke failed', 'error'));
                        }}
                      >
                        Revoke
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Section: Team Directory */}
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Team Members
            </div>
            <Pill color={G.gold} small>
              {staff.length} MEMBERS
            </Pill>
          </div>

          <div style={{ fontSize: 12, color: G.muted }}>
            Showing {filteredStaff.length} of {staff.length} users
          </div>
        </div>

        {/* Search and Filters Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          {/* Search Box */}
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
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 36,
                padding: search ? '0 32px 0 36px' : '0 12px 0 36px',
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
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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

          {/* Filter Pills & Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                onClick={() => setStatusFilter('all')}
                style={{
                  height: '100%',
                  background: statusFilter === 'all' ? G.gold : 'transparent',
                  color: statusFilter === 'all' ? G.onGold : G.muted,
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
                All ({staff.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                style={{
                  height: '100%',
                  background: statusFilter === 'active' ? G.gold : 'transparent',
                  color: statusFilter === 'active' ? G.onGold : G.muted,
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
                Active ({activeStaffCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('suspended')}
                style={{
                  height: '100%',
                  background: statusFilter === 'suspended' ? G.gold : 'transparent',
                  color: statusFilter === 'suspended' ? G.onGold : G.muted,
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
                Suspended ({suspendedStaffCount})
              </button>
            </div>

            {/* Role Filter Selector */}
            <Sel
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ marginBottom: 0, height: 36, minWidth: 150 }}
            >
              <option value="all">All Roles</option>
              <optgroup label="System Roles">
                {ALL_ROLES_WITH_DRIVER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
                  </option>
                ))}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Custom Roles">
                  {customRoles.map((cr) => (
                    <option key={cr.id} value={`custom:${cr.id}`}>
                      {cr.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Sel>
          </div>
        </div>

        {/* User Rows */}
        {filteredStaff.length === 0 ? (
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
              {search || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No team members match your filter criteria.'
                : 'No team members registered yet.'}
            </div>
            {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                style={{ marginTop: 6 }}
              >
                Clear all filters
              </Btn>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredStaff.map((u) => {
              const locked = isCompanyOwnerRole(u.role) || isSuperAdminRole(u.role);
              const value = u.customRoleId ? `custom:${u.customRoleId}` : `sys:${u.role}`;
              const st = u.status || 'active';
              const canStatus = can('users.suspend') && !isSuperAdminRole(u.role);
              const initials = getInitials(u.name, u.email);
              const avatar = getAvatarColor(u.email || u.name || u.id);

              const statusColor =
                st === 'active'
                  ? G.success
                  : st === 'suspended' || st === 'locked'
                  ? G.danger
                  : G.muted;

              return (
                <div
                  key={u.id}
                  style={{
                    background: G.card2,
                    border: `1px solid ${G.border}`,
                    borderRadius: RADIUS.md,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 14,
                    transition: 'border-color .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = G.border2;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = G.border;
                  }}
                >
                  {/* Left: User Avatar & Info */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flex: '1 1 240px',
                      minWidth: 200,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: avatar.bg,
                        color: avatar.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
                          {u.name || 'Unnamed Member'}
                        </span>
                        <Pill color={statusColor} small>
                          {st.toUpperCase()}
                        </Pill>
                        {u.customRoleName && (
                          <Pill color={G.purple} small>
                            {u.customRoleName}
                          </Pill>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: G.muted,
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {u.email}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Role Selector or Locked Role Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 180 }}>
                    {can('users.assign_role') && !locked ? (
                      <Sel
                        value={value}
                        style={{ marginBottom: 0, width: '100%', height: 36 }}
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
                                'success',
                              ),
                            )
                            .catch((err: any) => notify(err?.message || 'Update failed', 'error'));
                        }}
                      >
                        <optgroup label="System Roles">
                          {ALL_ROLES_WITH_DRIVER.map((r) => (
                            <option key={r} value={`sys:${r}`}>
                              {ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r}
                            </option>
                          ))}
                        </optgroup>
                        {customRoles.length > 0 && (
                          <optgroup label="Custom Roles">
                            {customRoles.map((r) => (
                              <option key={r.id} value={`custom:${r.id}`}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {u.customRoleId && !customRoles.some((r) => r.id === u.customRoleId) && (
                          <option value={`custom:${u.customRoleId}`}>
                            {u.customRoleName || 'Removed custom role'}
                          </option>
                        )}
                      </Sel>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Pill color={locked ? G.gold : G.muted}>
                          {locked ? '🛡️ ' : ''}
                          {u.customRoleName || ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                        </Pill>
                      </div>
                    )}
                  </div>

                  {/* Right: Security & Management Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {canStatus && st === 'active' && (
                      <Btn
                        variant="outline"
                        size="sm"
                        style={{ height: 32, fontSize: 12 }}
                        onClick={() => {
                          void authApi
                            .setUserStatus(u.id, 'suspended')
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() => notify('User suspended. Active sessions are revoked.'))
                            .catch((err: any) => notify(err?.message || 'Suspend failed', 'error'));
                        }}
                      >
                        Suspend
                      </Btn>
                    )}

                    {canStatus && st === 'active' && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        style={{ height: 32, fontSize: 12, color: G.muted }}
                        onClick={() => {
                          void authApi
                            .setUserStatus(u.id, 'locked')
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() => notify('User locked. Active sessions are revoked.'))
                            .catch((err: any) => notify(err?.message || 'Lock failed', 'error'));
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
                          variant="outline"
                          size="sm"
                          style={{ height: 32, fontSize: 12, color: G.gold }}
                          onClick={() => {
                            void authApi
                              .unlockUser(u.id)
                              .then(() => authApi.listUsers(cid).then(setStaff))
                              .then(() => notify('User unlocked. Temporary lockout cleared.', 'success'))
                              .catch((err: any) => notify(err?.message || 'Unlock failed', 'error'));
                          }}
                        >
                          Unlock
                        </Btn>
                      )}

                    {canStatus && (st === 'suspended' || st === 'inactive') && (
                      <Btn
                        variant="outline"
                        size="sm"
                        style={{ height: 32, fontSize: 12, color: G.success }}
                        onClick={() => {
                          void authApi
                            .setUserStatus(u.id, 'active')
                            .then(() => authApi.listUsers(cid).then(setStaff))
                            .then(() => notify('User reactivated', 'success'))
                            .catch((err: any) => notify(err?.message || 'Reactivate failed', 'error'));
                        }}
                      >
                        Reactivate
                      </Btn>
                    )}

                    {canStatus && st !== 'archived' && !locked && (
                      <Btn
                        variant="ghost"
                        size="sm"
                        style={{ height: 32, fontSize: 12, color: G.danger }}
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
                              .catch((err: any) => notify(err?.message || 'Archive failed', 'error'));
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
        )}
      </Card>
    </div>
  );
}
