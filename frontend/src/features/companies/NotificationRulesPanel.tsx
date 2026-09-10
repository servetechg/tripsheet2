import { useState, useMemo } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Card, Pill, Icons, Chk } from '@/components/ui';
import { companiesApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

export interface NotificationRuleItem {
  id: string;
  companyId?: string;
  eventType: string;
  channel: string;
  target: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface NotificationRulesPanelProps {
  cid: string;
  rules: NotificationRuleItem[];
  onReload: () => Promise<void> | void;
}

interface RuleMeta {
  title: string;
  description: string;
  category: string;
  icon: keyof typeof Icons;
  color: string;
  bg: string;
}

function getRuleMeta(eventType: string): RuleMeta {
  switch (eventType) {
    case 'security.lockout':
      return {
        title: 'Account Lockout Protection',
        description:
          'Alerts administrators immediately when repeated failed sign-in attempts lock an account.',
        category: 'Security & Access',
        icon: 'alert',
        color: '#F87171',
        bg: 'rgba(248, 113, 113, 0.12)',
      };
    case 'security.mfa_disabled':
      return {
        title: 'Two-Factor MFA Deactivated',
        description:
          'Sends an immediate high-priority alert when multi-factor authentication is disabled on any user account.',
        category: 'Authentication',
        icon: 'alert',
        color: '#FBBF24',
        bg: 'rgba(251, 191, 36, 0.12)',
      };
    case 'security.password_changed':
      return {
        title: 'Password Modified or Reset',
        description:
          'Dispatches notification whenever an account password or credential set is updated.',
        category: 'Credentials',
        icon: 'settings',
        color: '#A78BFA',
        bg: 'rgba(167, 139, 250, 0.12)',
      };
    case 'security.role_changed':
      return {
        title: 'Role & Permissions Changed',
        description:
          'Notifies when a staff member’s role, assigned permissions, or administrative access level is modified.',
        category: 'Governance',
        icon: 'assigned',
        color: '#FB923C',
        bg: 'rgba(251, 146, 60, 0.12)',
      };
    case 'security.login':
      return {
        title: 'Member Sign-In Activity',
        description:
          'Monitors sign-in sessions and notifies when a user authenticates to the company workspace.',
        category: 'Session Activity',
        icon: 'user',
        color: '#38BDF8',
        bg: 'rgba(56, 189, 248, 0.12)',
      };
    case 'security.invite_accepted':
      return {
        title: 'Member Invitation Accepted',
        description:
          'Triggered when an invited team member or driver accepts their invitation and joins the organization.',
        category: 'Onboarding',
        icon: 'completed',
        color: '#34D399',
        bg: 'rgba(52, 211, 153, 0.12)',
      };
    default:
      return {
        title: eventType
          .replace(/^security\./, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: `Automated alert triggered on the ${eventType} system event.`,
        category: 'System Event',
        icon: 'bell',
        color: G.gold,
        bg: 'rgba(61, 140, 255, 0.12)',
      };
  }
}

export function NotificationRulesPanel({
  cid,
  rules,
  onReload,
}: NotificationRulesPanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [localRules, setLocalRules] = useState<NotificationRuleItem[]>(rules);

  // Synchronize local optimistic state when parent rules change
  const currentRules = useMemo(() => {
    if (localRules.length === 0 && rules.length > 0) return rules;
    // Merge remote state while preserving recent updates
    return rules.map((r) => {
      const local = localRules.find((l) => l.id === r.id);
      return local || r;
    });
  }, [rules, localRules]);

  const activeCount = useMemo(
    () => currentRules.filter((r) => r.enabled).length,
    [currentRules],
  );
  const disabledCount = currentRules.length - activeCount;

  const filteredRules = useMemo(() => {
    let list = currentRules;
    if (filter === 'active') {
      list = list.filter((r) => r.enabled);
    } else if (filter === 'disabled') {
      list = list.filter((r) => !r.enabled);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const meta = getRuleMeta(r.eventType);
        return (
          r.eventType.toLowerCase().includes(q) ||
          r.channel.toLowerCase().includes(q) ||
          r.target.toLowerCase().includes(q) ||
          meta.title.toLowerCase().includes(q) ||
          meta.description.toLowerCase().includes(q) ||
          meta.category.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [currentRules, filter, search]);

  const toggleRule = async (rule: NotificationRuleItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (togglingIds.has(rule.id)) return;

    const nextEnabled = !rule.enabled;

    // Optimistic UI update
    setTogglingIds((prev) => new Set(prev).add(rule.id));
    setLocalRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextEnabled } : r)),
    );

    try {
      await companiesApi.saveNotificationRule(cid, {
        ...rule,
        enabled: nextEnabled,
      });
      await onReload();
      notify(
        `Rule "${rule.eventType}" ${nextEnabled ? 'enabled' : 'disabled'}`,
        'success',
      );
    } catch (err: any) {
      // Revert optimistic update
      setLocalRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !nextEnabled } : r)),
      );
      notify(err?.message || 'Failed to update notification rule', 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(rule.id);
        return next;
      });
    }
  };

  const setAllRules = async (enable: boolean) => {
    const targets = currentRules.filter((r) => r.enabled !== enable);
    if (targets.length === 0) {
      notify(`All rules are already ${enable ? 'enabled' : 'disabled'}`);
      return;
    }

    // Optimistic update
    const targetIds = new Set(targets.map((t) => t.id));
    setTogglingIds((prev) => new Set([...prev, ...targetIds]));
    setLocalRules((prev) =>
      prev.map((r) => (targetIds.has(r.id) ? { ...r, enabled: enable } : r)),
    );

    try {
      await Promise.all(
        targets.map((rule) =>
          companiesApi.saveNotificationRule(cid, {
            ...rule,
            enabled: enable,
          }),
        ),
      );
      await onReload();
      notify(`All rules ${enable ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      // Rollback
      await onReload();
      notify(err?.message || 'Failed to update some rules', 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const copyEventCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(code);
      notify(`Copied event key "${code}"`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Total Rules
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: G.text,
                marginTop: 4,
              }}
            >
              {currentRules.length}
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
              Seeded security triggers
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              background: 'rgba(61, 140, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.gold,
            }}
          >
            {Icons.bell({ size: 20, color: G.gold })}
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Active Alerts
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: G.success,
                marginTop: 4,
              }}
            >
              {activeCount}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: G.muted,
                  marginLeft: 4,
                }}
              >
                / {currentRules.length}
              </span>
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
              {currentRules.length > 0
                ? `${Math.round((activeCount / currentRules.length) * 100)}% active`
                : 'None configured'}
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              background: 'rgba(52, 211, 153, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.success,
            }}
          >
            {Icons.completed({ size: 20, color: G.success })}
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: G.muted,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Delivery Channel
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: G.text,
                marginTop: 6,
              }}
            >
              Email Queue
            </div>
            <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
              Target: User / Admin Mailbox
            </div>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.md,
              background: 'rgba(251, 191, 36, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.warning,
            }}
          >
            {Icons.dispatch({ size: 20, color: G.warning })}
          </div>
        </div>
      </div>

      {/* Modern Context Callout Banner */}
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(61, 140, 255, 0.08) 0%, rgba(26, 34, 52, 0.8) 100%)',
          border: `1px solid rgba(61, 140, 255, 0.22)`,
          borderRadius: RADIUS.md,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
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
          {Icons.bell({ size: 18, color: G.gold })}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: G.text,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Admin Notification Hooks
            <Pill color={G.gold} small>
              SMTP QUEUE
            </Pill>
          </div>
          <div
            style={{
              fontSize: 12,
              color: G.muted,
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            Includes security.* rules (login, password reset, role changes, MFA updates, invites, and account lockouts) seeded for each company tenant. Notifications are queued locally until your SMTP mail provider is configured.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Left: Search input with search icon */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 280px',
              maxWidth: 420,
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
              placeholder="Search alerts by event, type, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 36,
                padding: search ? '0 32px 0 36px' : '0 12px 0 36px',
                borderRadius: RADIUS.sm,
                border: `1px solid ${G.border}`,
                background: G.card,
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

          {/* Right: Filter tabs & Bulk Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
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
                onClick={() => setFilter('all')}
                style={{
                  height: '100%',
                  background: filter === 'all' ? G.gold : 'transparent',
                  color: filter === 'all' ? G.onGold : G.muted,
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
                All ({currentRules.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('active')}
                style={{
                  height: '100%',
                  background: filter === 'active' ? G.gold : 'transparent',
                  color: filter === 'active' ? G.onGold : G.muted,
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
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('disabled')}
                style={{
                  height: '100%',
                  background: filter === 'disabled' ? G.gold : 'transparent',
                  color: filter === 'disabled' ? G.onGold : G.muted,
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
                Disabled ({disabledCount})
              </button>
            </div>

            <Btn
              size="sm"
              variant="outline"
              onClick={() => void setAllRules(true)}
              style={{ fontSize: 12, height: 36, display: 'inline-flex', alignItems: 'center' }}
            >
              Enable All
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => void setAllRules(false)}
              style={{ fontSize: 12, height: 36, display: 'inline-flex', alignItems: 'center', color: G.muted }}
            >
              Disable All
            </Btn>
          </div>
        </div>
      </Card>

      {/* Rules List Cards */}
      {filteredRules.length === 0 ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            background: G.card,
            borderRadius: RADIUS.lg,
            border: `1px solid ${G.border}`,
            color: G.muted,
          }}
        >
          <div
            style={{
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
                background: G.card2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: G.muted,
              }}
            >
              {Icons.bell({ size: 22, color: G.muted })}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
              No notification rules found
            </div>
            <div style={{ fontSize: 12 }}>
              {search
                ? `No alerts match your filter "${search}".`
                : 'No notification rules match the selected filter.'}
            </div>
            {search && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => setSearch('')}
                style={{ marginTop: 6 }}
              >
                Clear filter
              </Btn>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredRules.map((r) => {
            const meta = getRuleMeta(r.eventType);
            const IconComp = Icons[meta.icon] || Icons.bell;
            const isToggling = togglingIds.has(r.id);

            return (
              <div
                key={r.id}
                onClick={() => void toggleRule(r)}
                style={{
                  background: r.enabled ? G.card2 : G.card,
                  border: `1px solid ${r.enabled ? G.border2 : G.border}`,
                  borderRadius: RADIUS.md,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                  boxShadow: r.enabled ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = G.gold;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = r.enabled
                    ? G.border2
                    : G.border;
                }}
              >
                {/* Left Side: Icon & Details */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: RADIUS.md,
                      background: meta.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: meta.color,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <IconComp size={20} color={meta.color} />
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
                          fontSize: 14,
                          fontWeight: 600,
                          color: r.enabled ? G.text : G.muted,
                        }}
                      >
                        {meta.title}
                      </span>
                      <span
                        onClick={(e) => copyEventCode(r.eventType, e)}
                        title="Click to copy event code"
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: G.muted,
                          background: G.bg,
                          padding: '2px 8px',
                          borderRadius: RADIUS.sm,
                          border: `1px solid ${G.border}`,
                          cursor: 'copy',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {r.eventType}
                        <Icons.copy size={10} color={G.muted} />
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: G.muted,
                        marginTop: 4,
                        lineHeight: 1.4,
                      }}
                    >
                      {meta.description}
                    </div>

                    {/* Channel & Target Badges */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Pill color={G.gold} small>
                        CHANNEL: {r.channel.toUpperCase()}
                      </Pill>
                      <Pill color={G.muted} small>
                        TARGET: {r.target.toUpperCase()}
                      </Pill>
                      <Pill color={meta.color} small>
                        {meta.category.toUpperCase()}
                      </Pill>
                    </div>
                  </div>
                </div>

                {/* Right Side: Status Badge & Themed Switch */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Pill color={r.enabled ? G.success : G.muted}>
                    {r.enabled ? 'ACTIVE' : 'DISABLED'}
                  </Pill>

                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Chk
                      checked={Boolean(r.enabled)}
                      disabled={isToggling}
                      onChange={() => void toggleRule(r)}
                      label={
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: r.enabled ? G.text : G.muted,
                          }}
                        >
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
