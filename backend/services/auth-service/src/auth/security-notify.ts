/**
 * Chapter 4 Phase 6 — security notification event types + message copy.
 * Delivery is queued via notification-service (email channel); no SMTP here.
 */

export const SECURITY_NOTIFY_TYPES = [
  'security.login',
  'security.password_changed',
  'security.role_changed',
  'security.mfa_disabled',
  'security.invite_accepted',
  'security.lockout',
] as const;

export type SecurityNotifyType = (typeof SECURITY_NOTIFY_TYPES)[number];

export type SecurityNotifyInput = {
  type: SecurityNotifyType;
  to: string;
  companyId?: string | null;
  userId?: string | null;
  ip?: string;
  userAgent?: string;
  detail?: string;
};

export function isSecurityNotifyType(v: unknown): v is SecurityNotifyType {
  return (
    typeof v === 'string' &&
    (SECURITY_NOTIFY_TYPES as readonly string[]).includes(v)
  );
}

export function securityNotifySubject(type: SecurityNotifyType): string {
  switch (type) {
    case 'security.login':
      return 'New sign-in to your FleetQuix account';
    case 'security.password_changed':
      return 'Your FleetQuix password was changed';
    case 'security.role_changed':
      return 'Your FleetQuix role or permissions changed';
    case 'security.mfa_disabled':
      return 'Authenticator (MFA) was disabled on your account';
    case 'security.invite_accepted':
      return 'Your FleetQuix invite was accepted';
    case 'security.lockout':
      return 'Your FleetQuix account was temporarily locked';
    default:
      return 'FleetQuix security notice';
  }
}

export function securityNotifyBody(input: SecurityNotifyInput): string {
  const when = new Date().toISOString();
  const ip = input.ip ? ` IP: ${input.ip}.` : '';
  const ua = input.userAgent
    ? ` Device: ${input.userAgent.slice(0, 120)}.`
    : '';
  const extra = input.detail ? ` ${input.detail}` : '';
  switch (input.type) {
    case 'security.login':
      return `A new sign-in to your FleetQuix account succeeded at ${when}.${ip}${ua}${extra} If this was not you, change your password and review sessions.`;
    case 'security.password_changed':
      return `Your FleetQuix password was changed at ${when}.${ip}${extra} If this was not you, reset your password immediately and contact your admin.`;
    case 'security.role_changed':
      return `Your FleetQuix role or permissions were updated at ${when}.${extra} You may need to sign in again. If unexpected, contact your company admin.`;
    case 'security.mfa_disabled':
      return `Authenticator (MFA) was disabled on your FleetQuix account at ${when}.${ip}${extra} All sessions were revoked. If this was not you, secure your account immediately.`;
    case 'security.invite_accepted':
      return `Your FleetQuix invite was accepted and your account is ready at ${when}.${extra}`;
    case 'security.lockout':
      return `Your FleetQuix account was temporarily locked after too many failed sign-in attempts at ${when}.${ip}${extra} Wait for the lockout to expire or ask an admin to unlock you.`;
    default:
      return `FleetQuix security event (${input.type}) at ${when}.`;
  }
}

export function securityNotifyPayload(input: SecurityNotifyInput) {
  const to = String(input.to || '')
    .trim()
    .toLowerCase();
  const body = securityNotifyBody(input);
  return {
    companyId: input.companyId || null,
    channel: 'email' as const,
    to,
    body,
    status: 'queued' as const,
    meta: {
      type: input.type,
      subject: securityNotifySubject(input.type),
      userId: input.userId || null,
      ip: input.ip || '',
      userAgent: (input.userAgent || '').slice(0, 200),
      category: 'security',
    },
  };
}

export function securityEventSeverity(
  type: SecurityNotifyType,
): 'info' | 'warning' {
  return type === 'security.lockout' ||
    type === 'security.mfa_disabled' ||
    type === 'security.password_changed'
    ? 'warning'
    : 'info';
}
