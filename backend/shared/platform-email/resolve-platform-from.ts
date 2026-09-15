/**
 * Visible platform From address — never the SMTP auth mailbox when avoidable.
 * SMTP_USER/SMTP_PASS = relay login; PLATFORM_FROM_EMAIL = what recipients see.
 */
export function resolvePlatformFromEmail(env: NodeJS.ProcessEnv): string {
  const explicit = String(env.PLATFORM_FROM_EMAIL || '').trim();
  const legacy = String(env.SMTP_FROM || '').trim();
  const auth = String(env.SMTP_USER || '').trim().toLowerCase();

  if (explicit) return explicit.toLowerCase();

  if (legacy && auth && legacy.toLowerCase() !== auth) {
    return legacy.toLowerCase();
  }

  return legacy.toLowerCase();
}

export function isPersonalSmtpFrom(env: NodeJS.ProcessEnv): boolean {
  const from = resolvePlatformFromEmail(env);
  const auth = String(env.SMTP_USER || '').trim().toLowerCase();
  return Boolean(from && auth && from === auth);
}
