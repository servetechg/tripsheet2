/**
 * Password policy for new/changed passwords (not existing logins).
 * Complexity, when enabled, requires min 12 + lower + upper + digit.
 */

export type PasswordPolicy = {
  minLength: number;
  complexity: boolean;
  sessionDays: number;
  lockoutThreshold: number;
  lockoutMinutes: number;
  idleTimeoutMinutes: number;
  requireMfa: boolean;
};

export const PLATFORM_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  complexity: false,
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
    sessionDays: clamp(Number(row.sessionDays), 1, 90, 7),
    lockoutThreshold: clamp(Number(row.lockoutThreshold), 3, 20, 5),
    lockoutMinutes: clamp(Number(row.lockoutMinutes), 1, 1440, 15),
    idleTimeoutMinutes: clamp(Number(row.idleTimeoutMinutes), 0, 480, 0),
    requireMfa: Boolean(row.requireMfa),
  };
}

export function assertPasswordMeetsPolicy(
  password: string,
  policy: PasswordPolicy,
): string | null {
  const pw = String(password || '');
  if (pw.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters`;
  }
  if (policy.complexity) {
    if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must include a number';
  }
  return null;
}

export function publicPasswordPolicy(policy: PasswordPolicy) {
  return {
    minLength: policy.minLength,
    complexity: policy.complexity,
    hint: policy.complexity
      ? `At least ${policy.minLength} characters, with upper, lower, and a number`
      : `At least ${policy.minLength} characters`,
  };
}
