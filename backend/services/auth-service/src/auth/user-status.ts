/**
 * Chapter 4 account lifecycle helpers.
 * Temporary failed-login lockout uses lockedUntil; status=locked is admin lock.
 */

export const USER_STATUSES = [
  'pending',
  'invited',
  'active',
  'inactive',
  'suspended',
  'locked',
  'archived',
] as const;

export type UserStatusCode = (typeof USER_STATUSES)[number];

/** Statuses that may authenticate (password login + JWT). */
export const AUTHENTICATABLE_STATUSES: ReadonlySet<string> = new Set([
  'active',
]);

export function isUserStatus(v: unknown): v is UserStatusCode {
  return typeof v === 'string' && (USER_STATUSES as readonly string[]).includes(v);
}

export function canAuthenticateStatus(status: string | undefined | null): boolean {
  return AUTHENTICATABLE_STATUSES.has(String(status || 'active'));
}

export function statusDenyReason(status: string | undefined | null): string {
  switch (String(status || '')) {
    case 'suspended':
      return 'Account suspended';
    case 'archived':
      return 'Account archived';
    case 'inactive':
      return 'Account inactive';
    case 'locked':
      return 'Account locked';
    case 'pending':
    case 'invited':
      return 'Account not activated';
    default:
      return 'Account not allowed to sign in';
  }
}

/** Admin-driven transitions allowed in Phase 1. */
export const ADMIN_SETTABLE_STATUSES: ReadonlySet<string> = new Set([
  'active',
  'inactive',
  'suspended',
  'locked',
  'archived',
]);
