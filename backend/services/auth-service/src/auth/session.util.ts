/**
 * Chapter 4 Phase 4 — session / refresh helpers.
 */
import { createHash } from 'crypto';

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function deviceLabelFromUa(ua: string): string {
  const s = String(ua || '').trim();
  if (!s) return 'Unknown device';
  let browser = 'Browser';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  let os = 'device';
  if (/Windows/i.test(s)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad/i.test(s)) os = 'iOS';
  else if (/Linux/i.test(s)) os = 'Linux';
  return `${browser} on ${os}`;
}

export function isSessionIdle(
  lastSeenAt: Date | string,
  idleTimeoutMinutes: number,
  now = Date.now(),
): boolean {
  if (!idleTimeoutMinutes || idleTimeoutMinutes <= 0) return false;
  const t =
    typeof lastSeenAt === 'string'
      ? Date.parse(lastSeenAt)
      : lastSeenAt.getTime();
  if (!Number.isFinite(t)) return false;
  return now - t > idleTimeoutMinutes * 60_000;
}

/** Access JWT lifetime in minutes (refresh uses sessionDays). */
export function accessTokenMinutesFromEnv(
  raw: string | undefined,
  fallback = 15,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1440, Math.max(5, Math.trunc(n)));
}
