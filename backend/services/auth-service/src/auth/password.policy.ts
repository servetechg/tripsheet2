/**
 * Password policy for new/changed passwords (not existing logins).
 * When complexity is on (Chapter 4 mode): min 12, upper, lower, digit,
 * special character, and ban name/email substrings.
 * History of last N hashes is enforced separately when changing passwords.
 */

export type PasswordPolicy = {
  minLength: number;
  complexity: boolean;
  /** How many prior password hashes to reject (0 = off). Default 10. */
  historyCount: number;
  sessionDays: number;
  lockoutThreshold: number;
  lockoutMinutes: number;
  idleTimeoutMinutes: number;
  requireMfa: boolean;
};

export type PasswordIdentity = {
  name?: string | null;
  email?: string | null;
};

export const PLATFORM_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  complexity: false,
  historyCount: 10,
  sessionDays: 7,
  lockoutThreshold: 5,
  lockoutMinutes: 15,
  idleTimeoutMinutes: 0,
  requireMfa: false,
};

function clamp(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function policyFromRow(
  row: Record<string, unknown> | null | undefined,
): PasswordPolicy {
  if (!row) return { ...PLATFORM_PASSWORD_POLICY };
  const complexity = Boolean(row.passwordComplexity);
  const minRaw = clamp(Number(row.passwordMinLength), 4, 128, 8);
  return {
    minLength: complexity ? Math.max(minRaw, 12) : minRaw,
    complexity,
    historyCount: clamp(Number(row.passwordHistoryCount), 0, 24, 10),
    sessionDays: clamp(Number(row.sessionDays), 1, 90, 7),
    lockoutThreshold: clamp(Number(row.lockoutThreshold), 3, 20, 5),
    lockoutMinutes: clamp(Number(row.lockoutMinutes), 1, 1440, 15),
    idleTimeoutMinutes: clamp(Number(row.idleTimeoutMinutes), 0, 480, 0),
    requireMfa: Boolean(row.requireMfa),
  };
}

/** Extract banned substrings (≥3 chars) from name / email local-part. */
export function bannedSubstringsFromIdentity(
  identity?: PasswordIdentity | null,
): string[] {
  const out = new Set<string>();
  const add = (raw: string) => {
    const s = raw.toLowerCase().trim();
    if (s.length >= 3) out.add(s);
  };
  if (identity?.email) {
    const local = String(identity.email).split('@')[0] || '';
    add(local);
    for (const part of local.split(/[._+\-]+/)) add(part);
  }
  if (identity?.name) {
    for (const part of String(identity.name).split(/[\s,._+\-]+/)) add(part);
  }
  return [...out];
}

export function assertPasswordMeetsPolicy(
  password: string,
  policy: PasswordPolicy,
  identity?: PasswordIdentity | null,
): string | null {
  const pw = String(password || '');
  if (pw.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }
  if (policy.complexity) {
    if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must include a number';
    if (!/[^A-Za-z0-9]/.test(pw)) {
      return 'Password must include a special character';
    }
    const lower = pw.toLowerCase();
    for (const ban of bannedSubstringsFromIdentity(identity)) {
      if (lower.includes(ban)) {
        return 'Password must not contain your name or email';
      }
    }
  }
  return null;
}

export function publicPasswordPolicy(policy: PasswordPolicy) {
  return {
    minLength: policy.minLength,
    complexity: policy.complexity,
    historyCount: policy.historyCount,
    hint: policy.complexity
      ? `At least ${policy.minLength} characters, with upper, lower, a number, and a special character (not your name or email)`
      : `At least ${policy.minLength} characters`,
  };
}
