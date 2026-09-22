/** Email meta types that should not trigger web push (no account yet, or test-only). */
export const EMAIL_PUSH_SKIP_TYPES = new Set([
  'driver_invite',
  'staff_invite',
  'email_delivery_test',
]);

export function resolvePushUserIdFromEmailMeta(
  meta: Record<string, unknown> | undefined,
): string | null {
  if (!meta) return null;
  const uid = meta.userId;
  if (typeof uid === 'string' && uid.trim()) return uid.trim();
  return null;
}

export function pushTitleFromEmailMeta(
  meta: Record<string, unknown> | undefined,
  body: string,
): string {
  const subject = meta?.subject;
  if (typeof subject === 'string' && subject.trim()) {
    return subject.trim().slice(0, 120);
  }
  const type = meta?.type ? String(meta.type) : '';
  if (type.startsWith('security.')) return 'FleetQuix security alert';
  if (type === 'password_reset') return 'Reset your FleetQuix password';
  if (type === 'email_change') return 'FleetQuix email change';
  if (type === 'driver.qualification_expiry') return 'Driver qualification alert';
  const trimmed = body.replace(/\s+/g, ' ').trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed || 'FleetQuix';
}

export function pushBodyFromEmailBody(body: string): string {
  const oneLine = body
    .replace(/https?:\/\/[^\s]+/g, '(link in email)')
    .replace(/\s+/g, ' ')
    .trim();
  return oneLine.slice(0, 200);
}

export function pushLinkForEmailType(type: string): string {
  switch (type) {
    case 'password_reset':
      return '/forgot-password';
    case 'email_change':
    case 'email_change_completed':
      return '/login';
    case 'security.login':
    case 'security.password_changed':
    case 'security.mfa_disabled':
    case 'security.lockout':
      return '/login';
    case 'security.role_changed':
    case 'security.invite_accepted':
      return '/';
    case 'driver.qualification_expiry':
      return '/';
    default:
      return '/';
  }
}

export function shouldMirrorEmailToPush(
  meta: Record<string, unknown> | undefined,
): boolean {
  const type = meta?.type ? String(meta.type) : '';
  if (EMAIL_PUSH_SKIP_TYPES.has(type)) return false;
  return resolvePushUserIdFromEmailMeta(meta) !== null;
}
